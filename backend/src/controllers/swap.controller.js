'use strict';

const { prisma } = require('../config/database');
const { ApiError } = require('../utils/ApiError');
const { notify }   = require('../services/notification.service');
const { emitToUser } = require('../sockets');
const { PLAN_LIMITS, SWAP_EXPIRY_DAYS } = require('../config/constants');
const logger  = require('../config/logger');

// ── Send Swap Request ─────────────────────────────────────────
exports.createSwap = async (req, res) => {
  const requesterId = req.user.id;
  const { recipientId, offeredSkillId, requestedSkillId, mode, frequency, plannedSessions, introMessage } = req.body;

  if (requesterId === recipientId) throw new ApiError(400, 'You cannot swap with yourself');

  // Check plan limits
  const requesterPlan = req.user.isPremium ? 'PREMIUM' : 'FREE';
  const maxSwaps = PLAN_LIMITS[requesterPlan].maxActiveSwaps;
  if (maxSwaps !== Infinity) {
    const activeCount = await prisma.swap.count({
      where: { requesterId, status: { in: ['ACTIVE', 'PENDING'] } },
    });
    if (activeCount >= maxSwaps) {
      throw new ApiError(403, `Free plan allows ${maxSwaps} active swaps. Upgrade to Premium for unlimited swaps.`);
    }
  }

  // Prevent duplicate swap requests
  const existing = await prisma.swap.findFirst({
    where: {
      requesterId,
      recipientId,
      status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] },
    },
  });
  if (existing) throw new ApiError(409, 'You already have an active or pending swap with this user');

  // Validate skills exist and belong to correct users
  const [offeredSkill, requestedSkill, recipient] = await Promise.all([
    prisma.userSkill.findFirst({ where: { id: offeredSkillId, userId: requesterId, direction: 'TEACH' } }),
    prisma.userSkill.findFirst({ where: { id: requestedSkillId, userId: recipientId, direction: 'TEACH' } }),
    prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, status: true, displayName: true } }),
  ]);

  if (!offeredSkill)   throw new ApiError(400, 'Offered skill not found or you are not listed as a teacher for it');
  if (!requestedSkill) throw new ApiError(400, 'Requested skill not found on the recipient profile');
  if (!recipient || recipient.status !== 'ACTIVE') throw new ApiError(404, 'User not found or unavailable');

  const expiresAt = new Date(Date.now() + SWAP_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const swap = await prisma.swap.create({
    data: {
      requesterId,
      recipientId,
      offeredSkillId,
      requestedSkillId,
      mode: mode || 'LIVE_VIDEO',
      frequency: frequency || 'WEEKLY',
      plannedSessions: plannedSessions || 6,
      introMessage,
      expiresAt,
    },
    include: {
      requester: { select: { id: true, displayName: true, avatarUrl: true } },
      recipient: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  // Notify recipient
  await notify({
    userId: recipientId,
    type: 'SWAP_REQUEST',
    title: 'New swap request!',
    body: `${swap.requester.displayName} wants to swap skills with you`,
    data: { swapId: swap.id },
  });

  emitToUser(recipientId, 'swap:new_request', { swap });

  logger.info(`Swap request created: ${swap.id} from ${requesterId} to ${recipientId}`);

  res.status(201).json({ success: true, data: { swap } });
};

// ── Get all swaps for current user ───────────────────────────
exports.getMySwaps = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const userId = req.user.id;
  const skip = (page - 1) * limit;

  const where = {
    OR: [{ requesterId: userId }, { recipientId: userId }],
    ...(status && { status }),
  };

  const [swaps, total] = await Promise.all([
    prisma.swap.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { lastActivityAt: 'desc' },
      include: {
        requester: { select: { id: true, displayName: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true, avatarUrl: true } },
        sessions: {
          orderBy: { scheduledAt: 'desc' },
          take: 1,
          select: { id: true, scheduledAt: true, status: true },
        },
        _count: { select: { sessions: true } },
      },
    }),
    prisma.swap.count({ where }),
  ]);

  res.json({
    success: true,
    data: { swaps },
    meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) },
  });
};

// ── Get single swap ─────────────────────────────────────────
exports.getSwap = async (req, res) => {
  const { swapId } = req.params;
  const userId = req.user.id;

  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      OR: [{ requesterId: userId }, { recipientId: userId }],
    },
    include: {
      requester: { select: { id: true, displayName: true, avatarUrl: true, timezone: true } },
      recipient: { select: { id: true, displayName: true, avatarUrl: true, timezone: true } },
      sessions: { orderBy: { scheduledAt: 'asc' }, include: { _count: { select: { reviews: true } } } },
      reviews: { include: { reviewer: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  });

  if (!swap) throw new ApiError(404, 'Swap not found');

  res.json({ success: true, data: { swap } });
};

// ── Accept Swap ──────────────────────────────────────────────
exports.acceptSwap = async (req, res) => {
  const { swapId } = req.params;
  const userId = req.user.id;

  const swap = await prisma.swap.findFirst({
    where: { id: swapId, recipientId: userId, status: 'PENDING' },
    include: { requester: { select: { id: true, displayName: true } } },
  });
  if (!swap) throw new ApiError(404, 'Pending swap request not found');

  // Check recipient plan limits
  const maxSwaps = PLAN_LIMITS[req.user.isPremium ? 'PREMIUM' : 'FREE'].maxActiveSwaps;
  if (maxSwaps !== Infinity) {
    const activeCount = await prisma.swap.count({
      where: { OR: [{ requesterId: userId }, { recipientId: userId }], status: 'ACTIVE' },
    });
    if (activeCount >= maxSwaps) {
      throw new ApiError(403, `You have reached the maximum active swap limit for your plan. Upgrade to Premium.`);
    }
  }

  const updated = await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'ACTIVE', lastActivityAt: new Date() },
  });

  await notify({
    userId: swap.requesterId,
    type: 'SWAP_ACCEPTED',
    title: 'Swap accepted! 🎉',
    body: `${swap.requester.displayName} accepted your swap request`,
    data: { swapId },
  });

  emitToUser(swap.requesterId, 'swap:accepted', { swapId });

  res.json({ success: true, data: { swap: updated } });
};

// ── Decline Swap ─────────────────────────────────────────────
exports.declineSwap = async (req, res) => {
  const { swapId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const swap = await prisma.swap.findFirst({
    where: { id: swapId, recipientId: userId, status: 'PENDING' },
    include: { recipient: { select: { displayName: true } } },
  });
  if (!swap) throw new ApiError(404, 'Pending swap request not found');

  await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'DECLINED', cancelReason: reason },
  });

  await notify({
    userId: swap.requesterId,
    type: 'SWAP_DECLINED',
    title: 'Swap request declined',
    body: `${swap.recipient.displayName} declined your swap request`,
    data: { swapId, reason },
  });

  emitToUser(swap.requesterId, 'swap:declined', { swapId, reason });

  res.json({ success: true, message: 'Swap request declined' });
};

// ── Counter-Propose ──────────────────────────────────────────
exports.counterPropose = async (req, res) => {
  const { swapId } = req.params;
  const { offeredSkillId, requestedSkillId, mode, frequency, plannedSessions, message } = req.body;
  const userId = req.user.id;

  const swap = await prisma.swap.findFirst({
    where: { id: swapId, recipientId: userId, status: 'PENDING' },
    include: { requester: { select: { id: true, displayName: true } } },
  });
  if (!swap) throw new ApiError(404, 'Pending swap not found');

  const updated = await prisma.swap.update({
    where: { id: swapId },
    data: {
      offeredSkillId: offeredSkillId || swap.offeredSkillId,
      requestedSkillId: requestedSkillId || swap.requestedSkillId,
      mode: mode || swap.mode,
      frequency: frequency || swap.frequency,
      plannedSessions: plannedSessions || swap.plannedSessions,
      introMessage: message || swap.introMessage,
      // Flip requester/recipient since roles reverse
      requesterId: userId,
      recipientId: swap.requesterId,
      lastActivityAt: new Date(),
    },
  });

  await notify({
    userId: swap.requesterId,
    type: 'SWAP_COUNTER',
    title: 'Counter-proposal received',
    body: `${swap.requester.displayName} sent you a revised swap proposal`,
    data: { swapId },
  });

  emitToUser(swap.requesterId, 'swap:counter_propose', { swapId });

  res.json({ success: true, data: { swap: updated } });
};

// ── Pause Swap ───────────────────────────────────────────────
exports.pauseSwap = async (req, res) => {
  const { swapId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const swap = await getActiveSwapForUser(swapId, userId);
  const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;

  await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'PAUSED', pauseReason: reason, pausedAt: new Date() },
  });

  await notify({
    userId: partnerId,
    type: 'SWAP_REQUEST', // reuse type for now
    title: 'Swap paused',
    body: `Your swap has been paused. Reason: ${reason || 'Not specified'}`,
    data: { swapId },
  });

  emitToUser(partnerId, 'swap:paused', { swapId, reason });

  res.json({ success: true, message: 'Swap paused successfully. Your SkillCoins are protected.' });
};

// ── Resume Swap ──────────────────────────────────────────────
exports.resumeSwap = async (req, res) => {
  const { swapId } = req.params;
  const userId = req.user.id;

  const swap = await prisma.swap.findFirst({
    where: { id: swapId, status: 'PAUSED', OR: [{ requesterId: userId }, { recipientId: userId }] },
  });
  if (!swap) throw new ApiError(404, 'Paused swap not found');

  await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'ACTIVE', pauseReason: null, pausedAt: null, lastActivityAt: new Date() },
  });

  const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;
  emitToUser(partnerId, 'swap:resumed', { swapId });

  res.json({ success: true, message: 'Swap resumed successfully' });
};

// ── Cancel Swap ──────────────────────────────────────────────
exports.cancelSwap = async (req, res) => {
  const { swapId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const swap = await getActiveSwapForUser(swapId, userId);
  const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;

  await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'CANCELLED', cancelReason: reason },
  });

  // Refund coins if partner hasn't fulfilled their sessions
  // This is handled by the dispute/coin-protection service

  await notify({
    userId: partnerId,
    type: 'SWAP_DECLINED',
    title: 'Swap cancelled',
    body: `A swap has been cancelled. Reason: ${reason || 'Not specified'}`,
    data: { swapId },
  });

  emitToUser(partnerId, 'swap:cancelled', { swapId, reason });

  res.json({ success: true, message: 'Swap cancelled. SkillCoin protection has been applied where applicable.' });
};

// ── Mark Complete ────────────────────────────────────────────
exports.completeSwap = async (req, res) => {
  const { swapId } = req.params;
  const userId = req.user.id;

  const swap = await getActiveSwapForUser(swapId, userId);

  await prisma.swap.update({
    where: { id: swapId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;

  // Notify both to leave reviews
  await Promise.all([
    notify({ userId, type: 'SESSION_COMPLETED', title: 'Swap complete! Leave a review.', body: 'How was your experience? Share your thoughts.', data: { swapId } }),
    notify({ userId: partnerId, type: 'SESSION_COMPLETED', title: 'Swap complete! Leave a review.', body: 'Share your feedback for this swap.', data: { swapId } }),
  ]);

  res.json({ success: true, message: 'Swap marked as complete. Review prompts have been sent.' });
};

// ── Open Dispute ─────────────────────────────────────────────
exports.openDispute = async (req, res) => {
  const { swapId } = req.params;
  const { reason, details, issueType } = req.body;
  const userId = req.user.id;

  const swap = await getActiveSwapForUser(swapId, userId);
  const targetUserId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;

  const report = await prisma.report.create({
    data: {
      reporterId: userId,
      targetUserId,
      targetType: 'SWAP',
      targetId: swapId,
      reason: issueType || reason,
      details,
      status: 'OPEN',
    },
  });

  logger.warn(`Dispute opened for swap ${swapId} by user ${userId}: ${issueType}`);

  res.status(201).json({
    success: true,
    message: 'Dispute submitted. Our moderation team will review it within 24 hours.',
    data: { reportId: report.id },
  });
};

// ── Helper ───────────────────────────────────────────────────
async function getActiveSwapForUser(swapId, userId) {
  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      OR: [{ requesterId: userId }, { recipientId: userId }],
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
  });
  if (!swap) throw new ApiError(404, 'Active swap not found');
  return swap;
}
