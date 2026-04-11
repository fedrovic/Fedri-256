'use strict';

const logger = require('../config/logger');

const BADGE_CRITERIA = {
  FIRST_SWAP: async (userId, prisma) => {
    const c = await prisma.swap.count({ where: { OR: [{ requesterId: userId }, { recipientId: userId }], status: { in: ['ACTIVE', 'COMPLETED'] } } });
    return c >= 1;
  },
  TEN_SESSIONS: async (userId, prisma) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { totalSessions: true } });
    return (u?.totalSessions || 0) >= 10;
  },
  FIFTY_SESSIONS: async (userId, prisma) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { totalSessions: true } });
    return (u?.totalSessions || 0) >= 50;
  },
  FIVE_STAR: async (userId, prisma) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { reputationScore: true, totalSessions: true } });
    return (u?.reputationScore || 0) >= 4.9 && (u?.totalSessions || 0) >= 5;
  },
  TOP_TEACHER: async (userId, prisma) => {
    const count = await prisma.review.count({ where: { revieweeId: userId, rating: 5 } });
    return count >= 10;
  },
  STREAK_30: async (userId, prisma) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const count = await prisma.session.count({
      where: { status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo }, participants: { some: { userId } } },
    });
    return count >= 4;
  },
};

const awardBadgeIfEligible = async (userId, badgeType) => {
  try {
    const { prisma } = require('../config/database');
    const { notify } = require('./notification.service');

    const existing = await prisma.badge.findUnique({ where: { userId_type: { userId, type: badgeType } } });
    if (existing) return null;

    const criterion = BADGE_CRITERIA[badgeType];
    if (!criterion) return null;

    const eligible = await criterion(userId, prisma);
    if (!eligible) return null;

    const badge = await prisma.badge.create({ data: { userId, type: badgeType } });

    await notify({
      userId,
      type:  'BADGE_AWARDED',
      title: `🏆 New badge: ${badgeType.replace(/_/g, ' ')}`,
      body:  'Check your profile to see your achievement!',
      data:  { badgeType },
    });

    logger.info(`Badge awarded: ${badgeType} → ${userId}`);
    return badge;
  } catch (err) {
    logger.error('awardBadgeIfEligible failed', { error: err.message, userId, badgeType });
    return null;
  }
};

const checkAllBadges = async (userId) => {
  for (const type of Object.keys(BADGE_CRITERIA)) {
    await awardBadgeIfEligible(userId, type);
  }
};

module.exports = { awardBadgeIfEligible, checkAllBadges };
