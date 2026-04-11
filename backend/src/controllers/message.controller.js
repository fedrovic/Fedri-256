'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden, sendPaginated } = require('../utils/apiResponse');
const logger  = require('../utils/logger');

// ── Get all conversations (inbox) ────────────────────────────
exports.getInbox = async (req, res) => {
  const userId = req.user.id;

  // Get all swaps with the latest message for each
  const swaps = await prisma.swap.findMany({
    where: {
      OR: [{ requesterId: userId }, { recipientId: userId }],
      status: { not: 'EXPIRED' },
    },
    include: {
      requester: { select: { id: true, displayName: true, avatarUrl: true } },
      recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: { isDeleted: false },
      },
      _count: {
        select: {
          messages: {
            where: { senderId: { not: userId }, readAt: null, isDeleted: false },
          },
        },
      },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  // Shape into inbox items
  const inbox = swaps.map(swap => {
    const partner = swap.requesterId === userId ? swap.recipient : swap.requester;
    const lastMsg = swap.messages[0] || null;
    return {
      swapId: swap.id,
      swapStatus: swap.status,
      partner,
      lastMessage: lastMsg ? {
        content: lastMsg.type === 'TEXT' ? lastMsg.content : `[${lastMsg.type.toLowerCase()}]`,
        senderId: lastMsg.senderId,
        sentAt: lastMsg.createdAt,
        isOwn: lastMsg.senderId === userId,
      } : null,
      unreadCount: swap._count.messages,
      updatedAt: swap.lastActivityAt,
    };
  });

  return sendSuccess(res, inbox);
};

// ── Get messages for a swap ───────────────────────────────────
exports.getMessages = async (req, res) => {
  const { swapId } = req.params;
  const { page = 1, limit = 50, before } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Verify swap access
  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      OR: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
    },
  });
  if (!swap) return sendNotFound(res, 'Conversation');

  const whereClause = {
    swapId,
    isDeleted: false,
    ...(before && { createdAt: { lt: new Date(before) } }),
  };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        reactions: {
          include: { /* user: { select: { id: true, displayName: true } } */ },
        },
      },
    }),
    prisma.message.count({ where: whereClause }),
  ]);

  // Mark messages as read
  await prisma.message.updateMany({
    where: { swapId, senderId: { not: req.user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return sendPaginated(res, messages.reverse(), page, limit, total);
};

// ── Send a message ────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  const { swapId } = req.params;
  const { content, type = 'TEXT' } = req.body;

  if (!content && type === 'TEXT') {
    return sendBadRequest(res, 'Message content required');
  }

  // Verify swap access
  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      status: { notIn: ['CANCELLED', 'DECLINED', 'EXPIRED'] },
      OR: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
    },
  });
  if (!swap) return sendNotFound(res, 'Conversation');

  // Check if blocked
  const partnerId = swap.requesterId === req.user.id ? swap.recipientId : swap.requesterId;
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: req.user.id, blockedId: partnerId },
        { blockerId: partnerId, blockedId: req.user.id },
      ],
    },
  });
  if (blocked) return sendForbidden(res, 'You cannot message this user');

  const message = await prisma.message.create({
    data: {
      swapId,
      senderId: req.user.id,
      content: content?.trim(),
      type,
      ...(req.file && {
        type: 'FILE',
        attachmentUrl: `${process.env.R2_PUBLIC_URL}/attachments/${swapId}/${req.file.filename}`,
        attachmentName: req.file.originalname,
        attachmentSize: req.file.size,
      }),
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  // Update swap lastActivityAt
  await prisma.swap.update({
    where: { id: swapId },
    data: { lastActivityAt: new Date() },
  });

  return sendCreated(res, message);
};

// ── Edit a message ────────────────────────────────────────────
exports.editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  const message = await prisma.message.findFirst({
    where: { id: messageId, senderId: req.user.id, isDeleted: false, type: 'TEXT' },
  });
  if (!message) return sendNotFound(res, 'Message');

  // Can only edit within 15 minutes
  const editWindow = new Date(message.createdAt.getTime() + 15 * 60 * 1000);
  if (new Date() > editWindow) {
    return sendBadRequest(res, 'Messages can only be edited within 15 minutes of sending');
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: content.trim(), isEdited: true, editedAt: new Date() },
    include: { sender: { select: { id: true, displayName: true } } },
  });

  return sendSuccess(res, updated, 'Message edited');
};

// ── Delete a message ──────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
  const { messageId } = req.params;

  const message = await prisma.message.findFirst({
    where: { id: messageId, senderId: req.user.id, isDeleted: false },
  });
  if (!message) return sendNotFound(res, 'Message');

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true, deletedAt: new Date(), content: null },
  });

  return sendSuccess(res, null, 'Message deleted');
};

// ── React to a message ────────────────────────────────────────
exports.addReaction = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  const ALLOWED_EMOJIS = ['👍','❤️','😊','🎉','🙏','🔥','👏','😂'];
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return sendBadRequest(res, 'Invalid emoji reaction');
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) return sendNotFound(res, 'Message');

  const reaction = await prisma.messageReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId: req.user.id, emoji } },
    update: {},
    create: { messageId, userId: req.user.id, emoji },
  });

  return sendCreated(res, reaction);
};

exports.removeReaction = async (req, res) => {
  const { messageId, emoji } = req.params;

  await prisma.messageReaction.deleteMany({
    where: { messageId, userId: req.user.id, emoji: decodeURIComponent(emoji) },
  });

  return sendSuccess(res, null, 'Reaction removed');
};

// ── Report a message ──────────────────────────────────────────
exports.reportMessage = async (req, res) => {
  const { messageId } = req.params;
  const { reason } = req.body;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { sender: { select: { id: true } } },
  });
  if (!message) return sendNotFound(res, 'Message');

  await prisma.report.create({
    data: {
      reporterId: req.user.id,
      reportedId: message.senderId,
      targetType: 'message',
      targetId: messageId,
      reason,
    },
  });

  return sendSuccess(res, null, 'Message reported. Our moderation team will review it within 24 hours.');
};
