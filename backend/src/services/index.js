'use strict';
// ═══════════════════════════════════════════════════════════════
//  SERVICES — notification, badge, background jobs
// ═══════════════════════════════════════════════════════════════

const { prisma } = require('../config/database');
const logger  = require('../utils/logger');

// ──────────────────────────────────────────────────────────────
//  NOTIFICATION SERVICE
// ──────────────────────────────────────────────────────────────
const notify = async ({ userId, type, title, body, data = {} }) => {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, data },
    });

    // Emit real-time via socket if user is online
    const { emitToUser } = require('../sockets');
    emitToUser(userId, 'notification:new', notification);

    return notification;
  } catch (err) {
    logger.error('Notification create failed', { error: err.message, userId, type });
  }
};

const notifySwapRequest = (recipientId, sender, swap) =>
  notify({
    userId: recipientId,
    type: 'SWAP_REQUEST',
    title: `${sender.displayName} wants to swap skills with you!`,
    body: `They offer to teach you their skill in exchange for yours.`,
    data: { swapId: swap.id, senderId: sender.id },
  });

const notifySwapAccepted = (requesterId, recipient, swap) =>
  notify({
    userId: requesterId,
    type: 'SWAP_ACCEPTED',
    title: `${recipient.displayName} accepted your swap! 🎉`,
    body: `Schedule your first session to get started.`,
    data: { swapId: swap.id, recipientId: recipient.id },
  });

const notifySessionReminder = (userId, session, isUrgent = false) =>
  notify({
    userId,
    type: 'SESSION_REMINDER',
    title: isUrgent ? '⚡ Your session starts in 30 minutes!' : '📅 Session reminder for tomorrow',
    body: `Don't forget to prepare your materials.`,
    data: { sessionId: session.id, swapId: session.swapId, isUrgent },
  });

const notifyNewMessage = (userId, sender, swapId) =>
  notify({
    userId,
    type: 'MESSAGE_RECEIVED',
    title: `New message from ${sender.displayName}`,
    body: 'Tap to reply',
    data: { swapId, senderId: sender.id },
  });

module.exports.notificationService = {
  notify,
  notifySwapRequest,
  notifySwapAccepted,
  notifySessionReminder,
  notifyNewMessage,
};

// ──────────────────────────────────────────────────────────────
//  BADGE SERVICE
// ──────────────────────────────────────────────────────────────
const BADGE_CRITERIA = {
  FIRST_SWAP: async (userId) => {
    const count = await prisma.swap.count({ where: { requesterId: userId, status: 'COMPLETED' } });
    return count >= 1;
  },
  TEN_SESSIONS: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalSessions: true } });
    return user?.totalSessions >= 10;
  },
  FIFTY_SESSIONS: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { totalSessions: true } });
    return user?.totalSessions >= 50;
  },
  FIVE_STAR: async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { reputationScore: true, totalSessions: true } });
    return user?.reputationScore >= 4.9 && user?.totalSessions >= 5;
  },
  TOP_TEACHER: async (userId) => {
    const count = await prisma.review.count({ where: { revieweeId: userId, rating: 5 } });
    return count >= 10;
  },
  STREAK_30: async (userId) => {
    // 30-day active streak — simplified: active in last 30 days with sessions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sessions = await prisma.session.count({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: thirtyDaysAgo },
        participants: { some: { userId } },
      },
    });
    return sessions >= 4; // at least 4 sessions in 30 days = active streak
  },
};

const awardBadgeIfEligible = async (userId, badgeType) => {
  try {
    // Check if already awarded
    const existing = await prisma.badge.findUnique({
      where: { userId_type: { userId, type: badgeType } },
    });
    if (existing) return null;

    // Check eligibility
    const criterion = BADGE_CRITERIA[badgeType];
    if (!criterion) return null;

    const eligible = await criterion(userId);
    if (!eligible) return null;

    // Award badge
    const badge = await prisma.badge.create({
      data: { userId, type: badgeType },
    });

    // Notify user
    await notify({
      userId,
      type: 'BADGE_AWARDED',
      title: `New badge unlocked: ${badgeType.replace(/_/g, ' ')} 🏆`,
      body: 'Check your profile to see your achievement!',
      data: { badgeType },
    });

    logger.info(`Badge awarded: ${badgeType} → ${userId}`);
    return badge;
  } catch (err) {
    logger.error('Badge award failed', { error: err.message, userId, badgeType });
    return null;
  }
};

const checkAllBadges = async (userId) => {
  const types = Object.keys(BADGE_CRITERIA);
  for (const type of types) {
    await awardBadgeIfEligible(userId, type);
  }
};

module.exports.badgeService = { awardBadgeIfEligible, checkAllBadges };

// ──────────────────────────────────────────────────────────────
//  BACKGROUND JOBS
// ──────────────────────────────────────────────────────────────
const startJobs = () => {
  // Run every minute
  const MINUTE = 60 * 1000;
  const HOUR   = 60 * MINUTE;
  const DAY    = 24 * HOUR;

  // ── Session reminders (every 5 minutes) ─────────────────────
  setInterval(sendSessionReminders, 5 * MINUTE);

  // ── Auto-archive stale swaps (every 6 hours) ─────────────────
  setInterval(archiveStaleSwaps, 6 * HOUR);

  // ── Update response rates (every hour) ───────────────────────
  setInterval(updateResponseRates, HOUR);

  logger.info('Background jobs started');
};

const sendSessionReminders = async () => {
  try {
    const now = new Date();

    // 24-hour reminders
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sessions24h = await prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSent24h: false,
        scheduledAt: { gte: now, lte: in24h },
      },
      include: {
        participants: { include: { user: { select: { id: true } } } },
      },
    });

    for (const session of sessions24h) {
      for (const p of session.participants) {
        await notifySessionReminder(p.userId, session, false);
      }
      await prisma.session.update({ where: { id: session.id }, data: { reminderSent24h: true } });
    }

    // 30-minute reminders
    const in30m = new Date(now.getTime() + 30 * 60 * 1000);
    const sessions30m = await prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        reminderSent30m: false,
        scheduledAt: { gte: now, lte: in30m },
      },
      include: {
        participants: { include: { user: { select: { id: true } } } },
      },
    });

    for (const session of sessions30m) {
      for (const p of session.participants) {
        await notifySessionReminder(p.userId, session, true);
      }
      await prisma.session.update({ where: { id: session.id }, data: { reminderSent30m: true } });
    }

    if (sessions24h.length + sessions30m.length > 0) {
      logger.info(`Sent ${sessions24h.length + sessions30m.length} session reminders`);
    }
  } catch (err) {
    logger.error('Session reminder job failed', { error: err.message });
  }
};

const archiveStaleSwaps = async () => {
  try {
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days

    const stale = await prisma.swap.findMany({
      where: {
        status: { in: ['PENDING', 'PAUSED'] },
        lastActivityAt: { lt: cutoff },
      },
      select: { id: true, requesterId: true, recipientId: true },
    });

    if (stale.length === 0) return;

    await prisma.swap.updateMany({
      where: { id: { in: stale.map(s => s.id) } },
      data: { status: 'EXPIRED' },
    });

    logger.info(`Archived ${stale.length} stale swaps`);
  } catch (err) {
    logger.error('Archive job failed', { error: err.message });
  }
};

const updateResponseRates = async () => {
  try {
    // For each user: (swaps responded to / total swaps received) * 100
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      take: 500, // process in batches
    });

    for (const user of users) {
      const [received, responded] = await Promise.all([
        prisma.swap.count({ where: { recipientId: user.id } }),
        prisma.swap.count({ where: { recipientId: user.id, status: { not: 'PENDING' } } }),
      ]);

      if (received > 0) {
        const rate = Math.round((responded / received) * 100);
        await prisma.user.update({ where: { id: user.id }, data: { responseRate: rate } });
      }
    }
  } catch (err) {
    logger.error('Response rate update failed', { error: err.message });
  }
};

module.exports.startJobs = startJobs;

// ──────────────────────────────────────────────────────────────
//  MATCH SERVICE
// ──────────────────────────────────────────────────────────────
const getMatchScore = (currentUser, candidate) => {
  let score = 0;

  const myTeach = new Set(currentUser.skills.filter(s => s.direction === 'TEACH').map(s => s.skillId));
  const myLearn = new Set(currentUser.skills.filter(s => s.direction === 'LEARN').map(s => s.skillId));

  candidate.skills.forEach(s => {
    if (s.direction === 'TEACH' && myLearn.has(s.skillId)) score += 30;
    if (s.direction === 'LEARN' && myTeach.has(s.skillId)) score += 20;
  });

  if (candidate.reputationScore >= 4.5) score += 15;
  if (candidate.totalSessions >= 10) score += 10;

  const daysSinceActive = candidate.lastActiveAt
    ? (Date.now() - new Date(candidate.lastActiveAt).getTime()) / 86400000
    : 999;

  if (daysSinceActive < 1) score += 20;
  else if (daysSinceActive < 7) score += 10;
  else if (daysSinceActive < 30) score += 5;

  return score;
};

module.exports.matchService = { getMatchScore };
