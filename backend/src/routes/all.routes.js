'use strict';
// ═══════════════════════════════════════════════════════════════
//  ALL ROUTES — SkillSwap API
//  Each section is a separate route file in production.
//  Consolidated here for clarity.
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { authenticate, authorize, requireEmailVerified, requirePremium, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// ── USER ROUTES ──────────────────────────────────────────────
const userRouter = express.Router();
const userCtrl   = require('../controllers/user.controller');

userRouter.get('/me',                  authenticate, userCtrl.getMe);
userRouter.patch('/me',                authenticate, userCtrl.updateProfile);
userRouter.post('/me/avatar',          authenticate, upload.single('avatar'), userCtrl.updateAvatar);
userRouter.get('/me/notification-prefs', authenticate, userCtrl.getNotificationPrefs);
userRouter.patch('/me/notification-prefs', authenticate, userCtrl.updateNotificationPrefs);
userRouter.delete('/me',               authenticate, userCtrl.deleteAccount);

userRouter.post('/me/skills',          authenticate, requireEmailVerified, userCtrl.addSkill);
userRouter.patch('/me/skills/:skillId', authenticate, userCtrl.updateSkill);
userRouter.delete('/me/skills/:skillId', authenticate, userCtrl.removeSkill);

userRouter.post('/me/availability',    authenticate, userCtrl.setAvailability);

userRouter.post('/block/:userId',      authenticate, userCtrl.blockUser);
userRouter.delete('/block/:userId',    authenticate, userCtrl.unblockUser);

userRouter.get('/:userId',             optionalAuth, userCtrl.getProfile);
userRouter.get('/:userId/reviews',     optionalAuth, userCtrl.getReviews);

module.exports.userRouter = userRouter;

// ── SESSION ROUTES ───────────────────────────────────────────
const sessionRouter = express.Router();
const sessionCtrl   = require('../controllers/session.controller');

sessionRouter.get('/upcoming',                authenticate, sessionCtrl.getUpcomingSessions);
sessionRouter.get('/:sessionId/join',         authenticate, sessionCtrl.joinSession);
sessionRouter.patch('/:sessionId/complete',   authenticate, sessionCtrl.completeSession);
sessionRouter.patch('/:sessionId/missed',     authenticate, sessionCtrl.reportMissed);
sessionRouter.patch('/:sessionId/reschedule', authenticate, sessionCtrl.rescheduleSession);
sessionRouter.get('/calendar/:icsToken',                    sessionCtrl.getCalendarInvite);

// Swap-scoped sessions
sessionRouter.post('/swap/:swapId',           authenticate, requireEmailVerified, sessionCtrl.scheduleSession);
sessionRouter.get('/swap/:swapId',            authenticate, sessionCtrl.getSwapSessions);

module.exports.sessionRouter = sessionRouter;

// ── MESSAGE ROUTES ───────────────────────────────────────────
const messageRouter = express.Router();
const messageCtrl   = require('../controllers/message.controller');

messageRouter.get('/inbox',                    authenticate, messageCtrl.getInbox);
messageRouter.get('/:swapId',                  authenticate, messageCtrl.getMessages);
messageRouter.post('/:swapId',                 authenticate, requireEmailVerified, upload.single('attachment'), messageCtrl.sendMessage);
messageRouter.patch('/:swapId/:messageId',     authenticate, messageCtrl.editMessage);
messageRouter.delete('/:swapId/:messageId',    authenticate, messageCtrl.deleteMessage);
messageRouter.post('/:swapId/:messageId/react', authenticate, messageCtrl.addReaction);
messageRouter.delete('/:swapId/:messageId/react/:emoji', authenticate, messageCtrl.removeReaction);
messageRouter.post('/:swapId/:messageId/report', authenticate, messageCtrl.reportMessage);

module.exports.messageRouter = messageRouter;

// ── REVIEW ROUTES ────────────────────────────────────────────
const reviewRouter = express.Router();
const reviewCtrl   = require('../controllers/review.controller');

reviewRouter.post('/',                      authenticate, requireEmailVerified, reviewCtrl.createReview);
reviewRouter.patch('/:reviewId/respond',    authenticate, reviewCtrl.respondToReview);
reviewRouter.post('/:reviewId/flag',        authenticate, reviewCtrl.flagReview);
reviewRouter.get('/user/:userId',           optionalAuth, reviewCtrl.getUserReviews);

module.exports.reviewRouter = reviewRouter;

// ── SEARCH ROUTES ────────────────────────────────────────────
const searchRouter = express.Router();
const searchCtrl   = require('../controllers/search.controller');

searchRouter.get('/users',       optionalAuth, searchCtrl.searchUsers);
searchRouter.get('/skills',                    searchCtrl.searchSkills);
searchRouter.get('/categories',                searchCtrl.getCategories);
searchRouter.get('/autocomplete',              searchCtrl.autocomplete);

module.exports.searchRouter = searchRouter;

// ── COIN ROUTES ──────────────────────────────────────────────
const coinRouter = express.Router();
const coinCtrl   = require('../controllers/coin.controller');

coinRouter.get('/wallet',         authenticate, coinCtrl.getWallet);
coinRouter.post('/spend',         authenticate, coinCtrl.spendCoins);
coinRouter.post('/purchase',      authenticate, coinCtrl.purchaseCoins);
coinRouter.post('/transfer',      authenticate, coinCtrl.transferCoins);

module.exports.coinRouter = coinRouter;

// ── NOTIFICATION ROUTES ──────────────────────────────────────
const notifRouter = express.Router();
const notifCtrl   = require('../controllers/notification.controller');

notifRouter.get('/',                    authenticate, notifCtrl.getNotifications);
notifRouter.get('/unread-count',        authenticate, notifCtrl.getUnreadCount);
notifRouter.patch('/read-all',          authenticate, notifCtrl.markAllRead);
notifRouter.patch('/:notificationId',   authenticate, notifCtrl.markRead);
notifRouter.delete('/:notificationId',  authenticate, notifCtrl.deleteNotification);

module.exports.notifRouter = notifRouter;

// ── ADMIN ROUTES ─────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(authenticate, authorize('ADMIN', 'MODERATOR'));

adminRouter.get('/stats', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');

  const [
    totalUsers, activeUsers, totalSwaps, activeSwaps,
    totalSessions, completedSessions, openReports,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { status: 'ACTIVE', lastActiveAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    prisma.swap.count(),
    prisma.swap.count({ where: { status: 'ACTIVE' } }),
    prisma.session.count(),
    prisma.session.count({ where: { status: 'COMPLETED' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);

  return sendSuccess(res, {
    users: { total: totalUsers, active: activeUsers },
    swaps: { total: totalSwaps, active: activeSwaps },
    sessions: { total: totalSessions, completed: completedSessions },
    moderation: { openReports },
  });
});

adminRouter.get('/reports', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');
  const { status = 'OPEN', page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const reports = await prisma.report.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    skip, take: parseInt(limit),
    include: {
      reporter: { select: { id: true, displayName: true, email: true } },
      reported: { select: { id: true, displayName: true, email: true } },
    },
  });
  return sendSuccess(res, reports);
});

adminRouter.patch('/reports/:reportId', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');
  const { resolution, status } = req.body;
  const report = await prisma.report.update({
    where: { id: req.params.reportId },
    data: { status, resolution, resolvedById: req.user.id, resolvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'REPORT_RESOLVED', targetId: req.params.reportId, targetType: 'report', metadata: { resolution } },
  });
  return sendSuccess(res, report, 'Report resolved');
});

adminRouter.patch('/users/:userId/suspend', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');
  const { days = 7, reason } = req.body;

  const lockedUntil = new Date(Date.now() + days * 86400000);
  await prisma.user.update({
    where: { id: req.params.userId },
    data: { status: 'SUSPENDED', lockedUntil },
  });
  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'USER_SUSPENDED', targetId: req.params.userId, targetType: 'user', metadata: { days, reason } },
  });
  return sendSuccess(res, null, `User suspended for ${days} days`);
});

adminRouter.patch('/users/:userId/ban', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');
  const { reason } = req.body;

  await prisma.user.update({
    where: { id: req.params.userId },
    data: { status: 'BANNED' },
  });
  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'USER_BANNED', targetId: req.params.userId, targetType: 'user', metadata: { reason } },
  });
  return sendSuccess(res, null, 'User banned');
});

adminRouter.patch('/users/:userId/unban', async (req, res) => {
  const prisma = require('../config/database');
  const { sendSuccess } = require('../utils/apiResponse');
  await prisma.user.update({ where: { id: req.params.userId }, data: { status: 'ACTIVE', lockedUntil: null } });
  return sendSuccess(res, null, 'User reinstated');
});

module.exports.adminRouter = adminRouter;

// ── WEBHOOK ROUTES ───────────────────────────────────────────
const webhookRouter = express.Router();

webhookRouter.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig    = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const userId   = session.metadata?.userId;
    const coins    = parseInt(session.metadata?.coins, 10);
    if (userId && coins) {
      await require('../controllers/coin.controller').creditCoinsAfterPayment(userId, coins, session.id);
    }
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub      = event.data.object;
    const userId   = sub.metadata?.userId;
    const isActive = sub.status === 'active';
    if (userId) {
      await require('../config/database').prisma.user.update({
        where: { id: userId },
        data: { isPremium: isActive, premiumExpiresAt: isActive ? new Date(sub.current_period_end * 1000) : null },
      });
    }
  }

  return res.json({ received: true });
});

module.exports.webhookRouter = webhookRouter;

// ── SKILL CATALOG ROUTES ─────────────────────────────────────
const skillRouter = express.Router();

skillRouter.get('/',       searchCtrl.searchSkills);
skillRouter.get('/cats',   searchCtrl.getCategories);
skillRouter.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  const prisma = require('../config/database');
  const { sendCreated } = require('../utils/apiResponse');
  const { name, categoryId, description } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const skill = await prisma.skill.create({ data: { name, slug, categoryId, description }, include: { category: true } });
  return sendCreated(res, skill);
});

const searchCtrl2 = require('../controllers/search.controller');
skillRouter.get('/cats',   searchCtrl2.getCategories);
skillRouter.get('/',       searchCtrl2.searchSkills);

module.exports.skillRouter = skillRouter;
