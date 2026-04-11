'use strict';

const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { prisma } = require('../config/database');

// All admin routes require authentication + ADMIN or MODERATOR role
router.use(authenticate, requireRole('ADMIN', 'MODERATOR'));

// ── Platform stats ─────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const sevenDaysAgo  = new Date(Date.now() -  7 * 86_400_000);

    const [
      totalUsers, newUsersMonth, activeUsers,
      totalSwaps, activeSwaps, completedSwaps,
      totalSessions, completedSessions,
      openReports, totalCoinsInCirculation,
      premiumUsers,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo }, status: 'ACTIVE' } }),
      prisma.swap.count(),
      prisma.swap.count({ where: { status: 'ACTIVE' } }),
      prisma.swap.count({ where: { status: 'COMPLETED' } }),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'COMPLETED' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.coinTransaction.aggregate({ _sum: { amount: true }, where: { type: 'EARN' } }),
      prisma.user.count({ where: { isPremium: true } }),
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newThisMonth: newUsersMonth, activeThisWeek: activeUsers, premium: premiumUsers },
        swaps: { total: totalSwaps, active: activeSwaps, completed: completedSwaps },
        sessions: { total: totalSessions, completed: completedSessions },
        coins: { totalEarned: totalCoinsInCirculation._sum.amount || 0 },
        moderation: { openReports },
      },
    });
  } catch (err) { next(err); }
});

// ── User management ────────────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const { q, status, role, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(role   && { role }),
      ...(q && {
        OR: [
          { email:       { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, displayName: true, role: true, status: true,
          isPremium: true, coinBalance: true, reputationScore: true,
          totalSessions: true, createdAt: true, lastActiveAt: true,
          _count: { select: { swapsAsRequester: true, reviewsReceived: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: users, meta: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
});

router.get('/users/:userId', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: {
        skills: { include: { skill: true } },
        badges: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { swapsAsRequester: true, swapsAsRecipient: true, reviewsReceived: true } },
      },
    });
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.patch('/users/:userId/suspend', async (req, res, next) => {
  try {
    const { days = 7, reason } = req.body;
    const lockedUntil = new Date(Date.now() + parseInt(days) * 86_400_000);
    await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'SUSPENDED', lockedUntil } });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'USER_SUSPENDED', targetType: 'user', targetId: req.params.userId, metadata: { days, reason } },
    });
    res.json({ success: true, message: `User suspended for ${days} days` });
  } catch (err) { next(err); }
});

router.patch('/users/:userId/ban', async (req, res, next) => {
  try {
    const { reason } = req.body;
    await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'BANNED' } });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'USER_BANNED', targetType: 'user', targetId: req.params.userId, metadata: { reason } },
    });
    res.json({ success: true, message: 'User banned' });
  } catch (err) { next(err); }
});

router.patch('/users/:userId/unban', async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'ACTIVE', lockedUntil: null, loginAttempts: 0 } });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'USER_REINSTATED', targetType: 'user', targetId: req.params.userId },
    });
    res.json({ success: true, message: 'User reinstated' });
  } catch (err) { next(err); }
});

router.patch('/users/:userId/role', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid role' } });
    }
    await prisma.user.update({ where: { id: req.params.userId }, data: { role } });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'USER_ROLE_CHANGED', targetType: 'user', targetId: req.params.userId, metadata: { newRole: role } },
    });
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) { next(err); }
});

// ── Reports / moderation queue ─────────────────────────────────
router.get('/reports', async (req, res, next) => {
  try {
    const { status = 'OPEN', targetType, page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      ...(status     && { status }),
      ...(targetType && { targetType }),
    };
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          reported: { select: { id: true, displayName: true, email: true, avatarUrl: true, status: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);
    res.json({ success: true, data: reports, meta: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
});

router.patch('/reports/:reportId', async (req, res, next) => {
  try {
    const { resolution, status } = req.body;
    const VALID_STATUSES = ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: { message: `status must be one of: ${VALID_STATUSES.join(', ')}` } });
    }
    const report = await prisma.report.update({
      where: { id: req.params.reportId },
      data: { status, resolution, resolvedById: req.user.id, resolvedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'REPORT_RESOLVED', targetType: 'report', targetId: req.params.reportId, metadata: { resolution, status } },
    });
    res.json({ success: true, data: report, message: 'Report resolved' });
  } catch (err) { next(err); }
});

// ── Disputes ───────────────────────────────────────────────────
router.get('/disputes', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: status ? { status } : {},
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          swap: { include: { requester: { select: { id: true, displayName: true } }, recipient: { select: { id: true, displayName: true } } } },
          initiator: { select: { id: true, displayName: true, email: true } },
        },
      }),
      prisma.dispute.count({ where: status ? { status } : {} }),
    ]);
    res.json({ success: true, data: disputes, meta: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
});

router.patch('/disputes/:disputeId', async (req, res, next) => {
  try {
    const { status, resolution, refundAmount } = req.body;
    const dispute = await prisma.dispute.update({
      where: { id: req.params.disputeId },
      data: { status, resolution, refundAmount, resolvedById: req.user.id, resolvedAt: new Date() },
    });

    // If refund approved, credit coins back to initiator
    if (status === 'RESOLVED_REFUND' && refundAmount > 0) {
      const updated = await prisma.user.update({
        where: { id: dispute.initiatorId },
        data: { coinBalance: { increment: refundAmount } },
        select: { coinBalance: true },
      });
      await prisma.coinTransaction.create({
        data: {
          userId: dispute.initiatorId,
          type: 'REFUND',
          amount: refundAmount,
          balanceAfter: updated.coinBalance,
          description: `Dispute refund — case ${req.params.disputeId}`,
          swapId: dispute.swapId,
        },
      });
    }

    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'DISPUTE_RESOLVED', targetType: 'dispute', targetId: req.params.disputeId, metadata: { status, resolution } },
    });
    res.json({ success: true, data: dispute, message: 'Dispute resolved' });
  } catch (err) { next(err); }
});

// ── Skill verification ─────────────────────────────────────────
router.patch('/skills/:userSkillId/verify', async (req, res, next) => {
  try {
    const { tier } = req.body;
    const VALID_TIERS = ['COMMUNITY', 'PLATFORM_VERIFIED', 'CREDENTIAL_VERIFIED', 'PROFESSIONAL'];
    if (!VALID_TIERS.includes(tier)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid verification tier' } });
    }
    const skill = await prisma.userSkill.update({
      where: { id: req.params.userSkillId },
      data: { verificationTier: tier, verifiedAt: new Date() },
      include: { user: { select: { id: true, displayName: true } }, skill: true },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user.id, action: 'SKILL_VERIFIED', targetType: 'userSkill', targetId: req.params.userSkillId, metadata: { tier } },
    });
    res.json({ success: true, data: skill, message: `Skill verified as ${tier}` });
  } catch (err) { next(err); }
});

// ── Audit logs ─────────────────────────────────────────────────
router.get('/audit-logs', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { actorId, action, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      ...(actorId && { actorId }),
      ...(action  && { action: { contains: action, mode: 'insensitive' } }),
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, displayName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: logs, meta: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
});

// ── Broadcast announcement ─────────────────────────────────────
router.post('/broadcast', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { title, body, targetRole } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, error: { message: 'title and body required' } });
    }
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', ...(targetRole && { role: targetRole }) },
      select: { id: true },
    });
    // Create notifications in batches of 100
    const BATCH = 100;
    for (let i = 0; i < users.length; i += BATCH) {
      await prisma.notification.createMany({
        data: users.slice(i, i + BATCH).map(u => ({
          userId: u.id,
          type: 'SYSTEM',
          title,
          body,
          data: { broadcast: true },
        })),
      });
    }
    res.json({ success: true, message: `Announcement sent to ${users.length} users` });
  } catch (err) { next(err); }
});

module.exports = router;
