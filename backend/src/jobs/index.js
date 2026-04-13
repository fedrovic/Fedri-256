'use strict';
// ════════════════════════════════════════════════════════════════
//  src/jobs/index.js  —  Background job scheduler
//  Runs on server start. In production, swap setInterval for
//  Bull queues backed by Redis for reliability + retries.
// ════════════════════════════════════════════════════════════════

const logger = require('../config/logger');

const startJobs = () => {
  // Stagger starts so they don't all fire at once on boot
  setTimeout(() => sessionReminderJob(),       5_000);
  setTimeout(() => swapExpiryJob(),            15_000);
  setTimeout(() => responseRateJob(),          30_000);
  setTimeout(() => onlineStatusCleanupJob(),   45_000);

  setInterval(() => sessionReminderJob(),      5  * 60_000);   // every 5 min
  setInterval(() => swapExpiryJob(),           6  * 3_600_000); // every 6 hrs
  setInterval(() => responseRateJob(),         1  * 3_600_000); // every hour
  setInterval(() => onlineStatusCleanupJob(),  10 * 60_000);   // every 10 min

  logger.info('✅ Background jobs started (session reminders, swap expiry, response rates, presence cleanup)');
};

// ── Job: Session Reminders ────────────────────────────────────
const sessionReminderJob = async () => {
  try {
    const { prisma }      = require('../config/database');
    const { notify }      = require('../services');
    const { sendEmail }   = require('../services/email.service');
    const now             = new Date();

    // 24-hour window
    const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
    const sessions24h = await prisma.session.findMany({
      where: { status: 'SCHEDULED', reminderSent24h: false, scheduledAt: { gte: now, lte: tomorrow } },
      include: {
        teacher: { select: { id: true, email: true, displayName: true } },
        learner: { select: { id: true, email: true, displayName: true } },
        swap: { select: { id: true } },
      },
    });

    for (const session of sessions24h) {
      const users = [session.teacher, session.learner].filter(Boolean);
      for (const user of users) {
        const partner = users.find(u => u.id !== user.id);
        await notify({
          userId: user.id,
          type:   'SESSION_REMINDER',
          title:  `📅 Session with ${partner?.displayName} tomorrow`,
          body:   `Don't forget — your session is scheduled for ${new Date(session.scheduledAt).toLocaleTimeString()}`,
          data:   { sessionId: session.id, swapId: session.swap?.id },
        });
        if (user.email) {
          await sendEmail({
            to:       user.email,
            template: 'session-reminder',
            data:     { partnerName: partner?.displayName, timeUntil: '24 hours', scheduledAt: session.scheduledAt },
          });
        }
      }
      await prisma.session.update({ where: { id: session.id }, data: { reminderSent24h: true } });
    }

    // 30-minute window
    const in30m = new Date(now.getTime() + 30 * 60_000);
    const sessions30m = await prisma.session.findMany({
      where: { status: 'SCHEDULED', reminderSent30m: false, scheduledAt: { gte: now, lte: in30m } },
      include: {
        teacher: { select: { id: true, email: true, displayName: true } },
        learner: { select: { id: true, email: true, displayName: true } },
        swap: { select: { id: true } },
      },
    });

    for (const session of sessions30m) {
      const users = [session.teacher, session.learner].filter(Boolean);
      for (const user of users) {
        const partner = users.find(u => u.id !== user.id);
        await notify({
          userId: user.id,
          type:   'SESSION_REMINDER',
          title:  `⚡ Your session starts in 30 minutes!`,
          body:   `Join your session with ${partner?.displayName} now`,
          data:   { sessionId: session.id, swapId: session.swap?.id, urgent: true },
        });
      }
      await prisma.session.update({ where: { id: session.id }, data: { reminderSent30m: true } });
    }

    const total = sessions24h.length + sessions30m.length;
    if (total > 0) logger.info(`Session reminders sent: ${total}`);
  } catch (err) {
    logger.error('sessionReminderJob failed', { error: err.message });
  }
};

// ── Job: Swap Expiry ──────────────────────────────────────────
const swapExpiryJob = async () => {
  try {
    const { prisma } = require('../config/database');
    const { notify } = require('../services');
    const now        = new Date();
    const { SWAP_EXPIRY_DAYS, SWAP_WARNING_DAYS } = require('../config/constants');

    // Archive swaps past their expiry date
    const expired = await prisma.swap.findMany({
      where: { status: { in: ['PENDING', 'PAUSED'] }, expiresAt: { lt: now } },
      select: { id: true, requesterId: true, recipientId: true },
    });

    if (expired.length > 0) {
      await prisma.swap.updateMany({
        where: { id: { in: expired.map(s => s.id) } },
        data:  { status: 'EXPIRED' },
      });
      logger.info(`Expired ${expired.length} stale swaps`);
    }

    // Warn swaps approaching expiry (within WARNING_DAYS)
    const warnBefore = new Date(now.getTime() + SWAP_WARNING_DAYS * 86_400_000);
    const expiringSoon = await prisma.swap.findMany({
      where: { status: 'ACTIVE', expiresAt: { gte: now, lte: warnBefore }, lastActivityAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
      select: { id: true, requesterId: true, recipientId: true, expiresAt: true },
    });

    for (const swap of expiringSoon) {
      const daysLeft = Math.ceil((new Date(swap.expiresAt) - now) / 86_400_000);
      const msg = `Schedule a session to keep it active — ${daysLeft} days left.`;
      await Promise.all([
        notify({ userId: swap.requesterId, type: 'SYSTEM', title: '⚠ Swap expiring soon', body: msg, data: { swapId: swap.id, daysLeft } }),
        notify({ userId: swap.recipientId, type: 'SYSTEM', title: '⚠ Swap expiring soon', body: msg, data: { swapId: swap.id, daysLeft } }),
      ]);
    }
  } catch (err) {
    logger.error('swapExpiryJob failed', { error: err.message });
  }
};

// ── Job: Response Rate Recalculation ─────────────────────────
const responseRateJob = async () => {
  try {
    const { prisma } = require('../config/database');

    // Get all active users in batches to avoid memory issues
    const BATCH_SIZE = 200;
    let cursor;

    while (true) {
      const users = await prisma.user.findMany({
        where:   { status: 'ACTIVE', isActive: true },
        select:  { id: true },
        take:    BATCH_SIZE,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) break;
      cursor = users[users.length - 1].id;

      for (const user of users) {
        const [received, responded] = await Promise.all([
          prisma.swap.count({ where: { recipientId: user.id } }),
          prisma.swap.count({ where: { recipientId: user.id, status: { notIn: ['PENDING'] } } }),
        ]);

        if (received > 0) {
          const rate = Math.round((responded / received) * 100);
          await prisma.user.update({ where: { id: user.id }, data: { responseRate: rate } });
        }
      }

      if (users.length < BATCH_SIZE) break;
    }
  } catch (err) {
    logger.error('responseRateJob failed', { error: err.message });
  }
};

// ── Job: Online Status Cleanup ────────────────────────────────
const onlineStatusCleanupJob = async () => {
  try {
    // Users inactive for 15+ min are considered offline
    // The sockets file handles this on disconnect, but this is a safety net
    const { getRedis } = require('../config/redis');
    const redis = getRedis();
    if (!redis) return;

    const staleKeys = await redis.keys('online:*');
    const now = Date.now();

    for (const key of staleKeys) {
      const lastSeen = await redis.get(key);
      if (lastSeen && now - parseInt(lastSeen) > 15 * 60_000) {
        await redis.del(key);
        const userId = key.replace('online:', '');
        const { prisma } = require('../config/database');
        await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(parseInt(lastSeen)) } }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('onlineStatusCleanupJob failed', { error: err.message });
  }
};

module.exports = { startJobs };
