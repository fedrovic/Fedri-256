'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden } = require('../utils/apiResponse');
const logger  = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// ── Schedule a session ────────────────────────────────────────
exports.scheduleSession = async (req, res) => {
  const { swapId } = req.params;
  const { scheduledAt, durationMinutes = 60, format = 'LIVE_VIDEO', agenda } = req.body;

  // Verify swap belongs to user and is active
  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      status: 'ACTIVE',
      OR: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
    },
    include: {
      requester: { select: { id: true, displayName: true, email: true } },
      recipient: { select: { id: true, displayName: true, email: true } },
    },
  });

  if (!swap) return sendNotFound(res, 'Swap');

  const proposedTime = new Date(scheduledAt);
  if (proposedTime <= new Date()) {
    return sendBadRequest(res, 'Session must be scheduled in the future');
  }

  // Check for time conflicts
  const partnerId = swap.requesterId === req.user.id ? swap.recipientId : swap.requesterId;
  const conflictWindow = new Date(proposedTime.getTime() - 30 * 60 * 1000);
  const conflictEnd    = new Date(proposedTime.getTime() + (durationMinutes + 30) * 60 * 1000);

  const conflict = await prisma.session.findFirst({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      scheduledAt: { gte: conflictWindow, lte: conflictEnd },
      participants: { some: { userId: { in: [req.user.id, partnerId] } } },
    },
  });

  if (conflict) {
    return sendBadRequest(res, 'This time conflicts with another session for you or your partner');
  }

  // Generate a unique video room ID
  const videoRoomId = `ss_${swapId}_${uuidv4().split('-')[0]}`;
  const icsToken    = uuidv4();

  const session = await prisma.session.create({
    data: {
      swapId,
      scheduledAt: proposedTime,
      durationMinutes,
      format,
      agenda,
      videoRoomId,
      icsToken,
      participants: {
        create: [
          { userId: req.user.id },
          { userId: partnerId },
        ],
      },
    },
    include: {
      swap: {
        include: {
          requester: { select: { id: true, displayName: true } },
          recipient: { select: { id: true, displayName: true } },
        },
      },
      participants: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });

  logger.info(`Session scheduled: ${session.id} for swap ${swapId}`);
  return sendCreated(res, session, 'Session scheduled. Both parties have been notified.');
};

// ── Get sessions for a swap ───────────────────────────────────
exports.getSwapSessions = async (req, res) => {
  const { swapId } = req.params;

  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      OR: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
    },
  });
  if (!swap) return sendNotFound(res, 'Swap');

  const sessions = await prisma.session.findMany({
    where: { swapId },
    orderBy: { scheduledAt: 'asc' },
    include: {
      participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      notes: { where: { userId: req.user.id } },
    },
  });

  return sendSuccess(res, sessions);
};

// ── Get upcoming sessions for current user ────────────────────
exports.getUpcomingSessions = async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: {
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      scheduledAt: { gte: new Date() },
      participants: { some: { userId: req.user.id } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: {
      swap: {
        include: {
          requester: { select: { id: true, displayName: true, avatarUrl: true } },
          recipient: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      },
      participants: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });

  return sendSuccess(res, sessions);
};

// ── Join session (get video room token) ───────────────────────
exports.joinSession = async (req, res) => {
  const { sessionId } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      participants: { some: { userId: req.user.id } },
    },
    include: { participants: true },
  });

  if (!session) return sendNotFound(res, 'Session');

  const now = new Date();
  const sessionTime = new Date(session.scheduledAt);
  const earlyJoinWindow = new Date(sessionTime.getTime() - 10 * 60 * 1000); // 10 min early

  if (now < earlyJoinWindow) {
    const minutesUntil = Math.ceil((earlyJoinWindow - now) / 60000);
    return sendBadRequest(res, `Session hasn't started yet. You can join ${minutesUntil} minutes before start time.`);
  }

  // Mark participant as joined
  await prisma.sessionParticipant.updateMany({
    where: { sessionId, userId: req.user.id },
    data: { joinedAt: new Date(), attended: true },
  });

  // Mark session as in progress if not already
  if (session.status === 'SCHEDULED') {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS' },
    });
  }

  // In production: generate Twilio/LiveKit access token for video room
  // For now return the room ID and a mock token
  const videoToken = `mock_video_token_${req.user.id}_${sessionId}`;

  return sendSuccess(res, {
    sessionId,
    videoRoomId: session.videoRoomId,
    videoToken,
    format: session.format,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
  });
};

// ── Mark session complete ─────────────────────────────────────
exports.completeSession = async (req, res) => {
  const { sessionId } = req.params;
  const { notes } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      participants: { some: { userId: req.user.id } },
    },
    include: {
      swap: {
        include: {
          requester: { select: { id: true, displayName: true } },
          recipient: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  if (!session) return sendNotFound(res, 'Session');

  const partnerId = session.swap.requesterId === req.user.id
    ? session.swap.recipientId
    : session.swap.requesterId;

  // Run everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark session complete
    const updatedSession = await tx.session.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // 2. Update swap progress
    await tx.swap.update({
      where: { id: session.swapId },
      data: {
        completedSessions: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });

    // 3. Award SkillCoin to current user (they taught this session's side)
    const earnAmount = 1;
    const user = await tx.user.update({
      where: { id: req.user.id },
      data: { coinBalance: { increment: earnAmount }, totalSessions: { increment: 1 } },
      select: { coinBalance: true },
    });

    await tx.coinTransaction.create({
      data: {
        userId: req.user.id,
        type: 'EARN',
        amount: earnAmount,
        balanceAfter: user.coinBalance,
        description: `Session completed — swap ${session.swapId}`,
        swapId: session.swapId,
        sessionId,
      },
    });

    // 4. Save session notes if provided
    if (notes) {
      await tx.sessionNote.create({
        data: { userId: req.user.id, swapId: session.swapId, sessionId, content: notes },
      });
    }

    return { updatedSession, newCoinBalance: user.coinBalance };
  });

  logger.info(`Session completed: ${sessionId} by user ${req.user.id}`);

  return sendSuccess(res, result, 'Session marked complete. SkillCoin credited!');
};

// ── Mark session missed ───────────────────────────────────────
exports.reportMissed = async (req, res) => {
  const { sessionId } = req.params;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      status: 'SCHEDULED',
      participants: { some: { userId: req.user.id } },
    },
  });
  if (!session) return sendNotFound(res, 'Session');

  if (new Date() < new Date(session.scheduledAt)) {
    return sendBadRequest(res, 'Session has not started yet');
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'MISSED', missedById: req.user.id },
  });

  return sendSuccess(res, null, 'Session reported as missed. Your reliability score may be affected.');
};

// ── Reschedule session ────────────────────────────────────────
exports.rescheduleSession = async (req, res) => {
  const { sessionId } = req.params;
  const { scheduledAt, reason } = req.body;

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      status: 'SCHEDULED',
      participants: { some: { userId: req.user.id } },
    },
    include: { swap: true },
  });
  if (!session) return sendNotFound(res, 'Session');

  // Count reschedules this month
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const rescheduleCount = await prisma.auditLog.count({
    where: {
      actorId: req.user.id,
      action: 'SESSION_RESCHEDULED',
      createdAt: { gte: monthStart },
    },
  });

  if (rescheduleCount >= 2) {
    return sendBadRequest(res, 'You have reached the maximum of 2 reschedules per month');
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { scheduledAt: new Date(scheduledAt), reminderSent24h: false, reminderSent30m: false },
  });

  await prisma.auditLog.create({
    data: { actorId: req.user.id, action: 'SESSION_RESCHEDULED', targetId: sessionId, targetType: 'session', metadata: { reason } },
  });

  return sendSuccess(res, null, 'Session rescheduled');
};

// ── Get ICS calendar file data ────────────────────────────────
exports.getCalendarInvite = async (req, res) => {
  const { icsToken } = req.params;

  const session = await prisma.session.findUnique({
    where: { icsToken },
    include: {
      swap: {
        include: {
          requester: { select: { displayName: true, email: true } },
          recipient: { select: { displayName: true, email: true } },
        },
      },
    },
  });

  if (!session) return sendNotFound(res, 'Session');

  const startDate = new Date(session.scheduledAt);
  const endDate   = new Date(startDate.getTime() + session.durationMinutes * 60 * 1000);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SkillSwap//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${session.id}@skillswap.io`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:SkillSwap Session`,
    `DESCRIPTION:Your skill exchange session via SkillSwap.`,
    `URL:https://app.skillswap.io/sessions/${session.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="skillswap-session.ics"`);
  return res.send(ics);
};

const formatICSDate = (date) =>
  date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
