'use strict';

const { prisma } = require('../config/database');
const { cache } = require('../config/redis');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

// ── Search users / matches ────────────────────────────────────
exports.searchUsers = async (req, res) => {
  const {
    q,
    category,
    tier,
    minRating,
    overlap,
    sessionType,
    proficiency,
    location,
    onlineOnly,
    sort = 'match',
    page  = 1,
    limit = 20,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const currentUserId = req.user?.id;

  // Build Prisma where clause
  const where = {
    deletedAt: null,
    status: 'ACTIVE',
    profileVisibility: currentUserId ? { in: ['PUBLIC', 'REGISTERED'] } : 'PUBLIC',
    ...(currentUserId && { id: { not: currentUserId } }),
    ...(minRating && { reputationScore: { gte: parseFloat(minRating) } }),
    ...(location && {
      location: { contains: location, mode: 'insensitive' },
    }),
  };

  // Filter by skill category or tier
  if (category || tier || proficiency || q) {
    where.skills = {
      some: {
        isActive: true,
        direction: 'TEACH',
        ...(tier && { verificationTier: tier }),
        ...(proficiency && { proficiency }),
        skill: {
          ...(category && { category: { slug: category } }),
          ...(q && {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }),
        },
      },
    };
  }

  // Build orderBy
  const orderByMap = {
    rating:   { reputationScore: 'desc' },
    sessions: { totalSessions: 'desc' },
    recent:   { lastActiveAt: 'desc' },
    match:    { reputationScore: 'desc' }, // fallback; real match scoring done in JS below
  };
  const orderBy = orderByMap[sort] || { reputationScore: 'desc' };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: parseInt(limit),
      select: {
        id: true, displayName: true, avatarUrl: true, location: true,
        timezone: true, reputationScore: true, totalSessions: true,
        responseRate: true, lastActiveAt: true,
        skills: {
          where: { isActive: true },
          include: { skill: { include: { category: true } } },
          take: 6,
        },
        availability: true,
        _count: { select: { reviewsReceived: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // ── Match scoring (server-side) ──────────────────────────────
  let scored = users;
  if (currentUserId && sort === 'match') {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        skills: { where: { isActive: true }, select: { skillId: true, direction: true } },
        availability: true,
        timezone: true,
      },
    });

    const myTeachSkillIds = new Set(
      currentUser.skills.filter(s => s.direction === 'TEACH').map(s => s.skillId)
    );
    const myLearnSkillIds = new Set(
      currentUser.skills.filter(s => s.direction === 'LEARN').map(s => s.skillId)
    );

    scored = users.map(user => {
      let score = 0;

      // +30 for each skill they teach that I want to learn
      user.skills.filter(s => s.direction === 'TEACH').forEach(s => {
        if (myLearnSkillIds.has(s.skillId)) score += 30;
      });

      // +20 for each skill I teach that they want to learn
      user.skills.filter(s => s.direction === 'LEARN').forEach(s => {
        if (myTeachSkillIds.has(s.skillId)) score += 20;
      });

      // +15 for rating above 4.5
      if (user.reputationScore >= 4.5) score += 15;

      // +10 for recently active (within 7 days)
      if (user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime()) < 7 * 86400000) {
        score += 10;
      }

      // Availability overlap score (simplified timezone check)
      const overlapHours = estimateOverlap(currentUser.availability, user.availability, currentUser.timezone, user.timezone);
      if (overlapHours >= 5) score += 25;
      else if (overlapHours >= 2) score += 10;

      return { ...user, matchScore: score, overlapHours };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  return sendPaginated(res, scored, page, limit, total);
};

// ── Search skills catalog ─────────────────────────────────────
exports.searchSkills = async (req, res) => {
  const { q, categoryId, page = 1, limit = 30 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const cacheKey = `skills:search:${q || ''}:${categoryId || ''}:${page}`;
  const cached = await cache.get(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where: {
        isApproved: true,
        ...(categoryId && { categoryId }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      include: { category: true, _count: { select: { userSkills: true } } },
      orderBy: { userSkills: { _count: 'desc' } },
      skip,
      take: parseInt(limit),
    }),
    prisma.skill.count({
      where: {
        isApproved: true,
        ...(categoryId && { categoryId }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
    }),
  ]);

  await cache.set(cacheKey, skills, 600); // cache 10 min
  return sendPaginated(res, skills, page, limit, total);
};

// ── Get all categories ────────────────────────────────────────
exports.getCategories = async (req, res) => {
  const cacheKey = 'categories:all';
  const cached = await cache.get(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    include: {
      children: { where: { isActive: true } },
      _count: { select: { skills: true } },
    },
    orderBy: { displayOrder: 'asc' },
  });

  await cache.set(cacheKey, categories, 3600); // 1 hour
  return sendSuccess(res, categories);
};

// ── Autocomplete ──────────────────────────────────────────────
exports.autocomplete = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return sendSuccess(res, []);

  const cacheKey = `autocomplete:${q.toLowerCase()}`;
  const cached = await cache.get(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const skills = await prisma.skill.findMany({
    where: {
      isApproved: true,
      name: { contains: q, mode: 'insensitive' },
    },
    select: { id: true, name: true, category: { select: { name: true } } },
    take: 8,
    orderBy: { userSkills: { _count: 'desc' } },
  });

  const results = skills.map(s => ({
    id: s.id,
    label: s.name,
    category: s.category?.name,
    type: 'skill',
  }));

  await cache.set(cacheKey, results, 120); // 2 min
  return sendSuccess(res, results);
};

// ── Helper: estimate weekly overlap hours ─────────────────────
function estimateOverlap(myAvail, theirAvail, myTz, theirTz) {
  if (!myAvail?.length || !theirAvail?.length) return 0;

  let totalOverlapHours = 0;

  myAvail.forEach(mySlot => {
    const matching = theirAvail.filter(s => s.dayOfWeek === mySlot.dayOfWeek);
    matching.forEach(theirSlot => {
      const myStart  = timeToMinutes(mySlot.startTime);
      const myEnd    = timeToMinutes(mySlot.endTime);
      const thStart  = timeToMinutes(theirSlot.startTime);
      const thEnd    = timeToMinutes(theirSlot.endTime);

      // Simplified: ignore timezone offset for now (real impl converts to UTC)
      const overlapStart = Math.max(myStart, thStart);
      const overlapEnd   = Math.min(myEnd, thEnd);
      if (overlapEnd > overlapStart) {
        totalOverlapHours += (overlapEnd - overlapStart) / 60;
      }
    });
  });

  return Math.round(totalOverlapHours);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
