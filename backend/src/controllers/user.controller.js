'use strict';

const { prisma } = require('../config/database');
const { cache } = require('../config/redis');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendPaginated } = require('../utils/apiResponse');
const logger  = require('../utils/logger');

// ── Get current user profile ──────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, email: true, displayName: true, firstName: true, lastName: true,
      avatarUrl: true, bio: true, location: true, timezone: true, languages: true,
      role: true, status: true, isPremium: true, premiumExpiresAt: true,
      coinBalance: true, reputationScore: true, totalSessions: true, responseRate: true,
      emailVerified: true, isTwoFactorEnabled: true, profileVisibility: true,
      createdAt: true, lastActiveAt: true,
      skills: {
        where: { isActive: true },
        include: { skill: { include: { category: true } } },
        orderBy: { createdAt: 'desc' },
      },
      availability: { orderBy: { dayOfWeek: 'asc' } },
      badges: { orderBy: { awardedAt: 'desc' } },
      _count: {
        select: {
          swapsAsRequester: true,
          swapsAsRecipient: true,
          reviewsReceived: true,
        },
      },
    },
  });

  if (!user) return sendNotFound(res, 'User');

  // Update last active
  await prisma.user.update({
    where: { id: req.user.id },
    data: { lastActiveAt: new Date() },
  });

  return sendSuccess(res, user, 'Profile retrieved');
};

// ── Get any public profile ─────────────────────────────────────
exports.getProfile = async (req, res) => {
  const { userId } = req.params;

  // Try cache first
  const cacheKey = `profile:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return sendSuccess(res, cached);

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true, displayName: true, avatarUrl: true, bio: true,
      location: true, timezone: true, languages: true,
      reputationScore: true, totalSessions: true, responseRate: true,
      profileVisibility: true, createdAt: true, lastActiveAt: true,
      skills: {
        where: { isActive: true },
        include: { skill: { include: { category: true } } },
      },
      availability: { orderBy: { dayOfWeek: 'asc' } },
      badges: { orderBy: { awardedAt: 'desc' } },
      reviewsReceived: {
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      _count: { select: { reviewsReceived: true } },
    },
  });

  if (!user) return sendNotFound(res, 'User');

  // Respect visibility
  if (user.profileVisibility === 'HIDDEN') {
    return sendNotFound(res, 'User');
  }
  if (user.profileVisibility === 'REGISTERED' && !req.user) {
    return sendNotFound(res, 'User');
  }

  // Cache for 5 minutes
  await cache.set(cacheKey, user, 300);

  return sendSuccess(res, user);
};

// ── Update profile ────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const {
    displayName, firstName, lastName, bio, location,
    timezone, languages, profileVisibility,
  } = req.body;

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(displayName && { displayName }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(bio !== undefined && { bio }),
      ...(location !== undefined && { location }),
      ...(timezone && { timezone }),
      ...(languages && { languages }),
      ...(profileVisibility && { profileVisibility }),
    },
    select: {
      id: true, displayName: true, firstName: true, lastName: true,
      bio: true, location: true, timezone: true, languages: true,
      profileVisibility: true, avatarUrl: true,
    },
  });

  // Invalidate cache
  await cache.del(`profile:${req.user.id}`);

  return sendSuccess(res, updated, 'Profile updated');
};

// ── Upload avatar ─────────────────────────────────────────────
exports.updateAvatar = async (req, res) => {
  if (!req.file) return sendBadRequest(res, 'No file uploaded');

  // In production: upload to R2, get URL back
  // For now we store the simulated URL
  const avatarUrl = `${process.env.R2_PUBLIC_URL || 'https://media.skillswap.io'}/avatars/${req.user.id}-${Date.now()}.jpg`;

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });

  await cache.del(`profile:${req.user.id}`);
  return sendSuccess(res, updated, 'Avatar updated');
};

// ── Manage skills ─────────────────────────────────────────────
exports.addSkill = async (req, res) => {
  const { skillId, direction, proficiency, description, portfolioUrl } = req.body;

  // Verify skill exists
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) return sendNotFound(res, 'Skill');

  // Check for duplicate
  const existing = await prisma.userSkill.findUnique({
    where: { userId_skillId_direction: { userId: req.user.id, skillId, direction } },
  });
  if (existing) return sendBadRequest(res, 'You already have this skill listed');

  const userSkill = await prisma.userSkill.create({
    data: {
      userId: req.user.id,
      skillId,
      direction,
      proficiency,
      description,
      portfolioUrl,
    },
    include: { skill: { include: { category: true } } },
  });

  await cache.del(`profile:${req.user.id}`);
  return sendCreated(res, userSkill, 'Skill added');
};

exports.updateSkill = async (req, res) => {
  const { skillId } = req.params;
  const { proficiency, description, portfolioUrl } = req.body;

  const userSkill = await prisma.userSkill.findFirst({
    where: { id: skillId, userId: req.user.id },
  });
  if (!userSkill) return sendNotFound(res, 'Skill');

  const updated = await prisma.userSkill.update({
    where: { id: skillId },
    data: { proficiency, description, portfolioUrl },
    include: { skill: true },
  });

  await cache.del(`profile:${req.user.id}`);
  return sendSuccess(res, updated, 'Skill updated');
};

exports.removeSkill = async (req, res) => {
  const { skillId } = req.params;

  const userSkill = await prisma.userSkill.findFirst({
    where: { id: skillId, userId: req.user.id },
  });
  if (!userSkill) return sendNotFound(res, 'Skill');

  await prisma.userSkill.update({
    where: { id: skillId },
    data: { isActive: false },
  });

  await cache.del(`profile:${req.user.id}`);
  return sendSuccess(res, null, 'Skill removed');
};

// ── Manage availability ───────────────────────────────────────
exports.setAvailability = async (req, res) => {
  const { availability } = req.body;
  // availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", timezone: "UTC" }]

  // Delete all existing and replace
  await prisma.availability.deleteMany({ where: { userId: req.user.id } });

  const created = await prisma.availability.createMany({
    data: availability.map(a => ({
      userId: req.user.id,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      timezone: a.timezone || req.user.timezone || 'UTC',
    })),
  });

  await cache.del(`profile:${req.user.id}`);
  return sendSuccess(res, created, 'Availability updated');
};

// ── Get user reviews ──────────────────────────────────────────
exports.getReviews = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId, isPublic: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.review.count({ where: { revieweeId: userId, isPublic: true } }),
  ]);

  return sendPaginated(res, reviews, page, limit, total);
};

// ── Notification preferences ──────────────────────────────────
exports.getNotificationPrefs = async (req, res) => {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: req.user.id },
  });
  return sendSuccess(res, prefs || getDefaultPrefs(req.user.id));
};

exports.updateNotificationPrefs = async (req, res) => {
  const data = req.body;
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: req.user.id },
    update: data,
    create: { userId: req.user.id, ...data },
  });
  return sendSuccess(res, prefs, 'Notification preferences updated');
};

const getDefaultPrefs = (userId) => ({
  userId,
  emailSwapRequest: true,
  emailSessionReminder: true,
  emailReview: true,
  emailMessage: false,
  pushSwapRequest: true,
  pushSessionReminder: true,
  pushMessage: true,
  inAppAll: true,
});

// ── Block user ────────────────────────────────────────────────
exports.blockUser = async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.id) return sendBadRequest(res, 'You cannot block yourself');

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: userId } },
    update: {},
    create: { blockerId: req.user.id, blockedId: userId },
  });

  return sendSuccess(res, null, 'User blocked');
};

exports.unblockUser = async (req, res) => {
  const { userId } = req.params;
  await prisma.block.deleteMany({
    where: { blockerId: req.user.id, blockedId: userId },
  });
  return sendSuccess(res, null, 'User unblocked');
};

// ── Delete account (soft delete) ──────────────────────────────
exports.deleteAccount = async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      deletedAt: new Date(),
      status: 'BANNED',
      email: `deleted_${req.user.id}@deleted.skillswap.io`,
    },
  });

  logger.info(`Account soft-deleted: ${req.user.id}`);
  return sendSuccess(res, null, 'Account deleted. Your data will be purged within 30 days.');
};
