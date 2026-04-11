'use strict';

const { Server } = require('socket.io');
const jwt    = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { client: redis } = require('../config/redis');
const logger = require('../config/logger');

let io;
const userSockets = new Map(); // userId → Set<socketId>

// ── Initialise Socket.IO ──────────────────────────────────────
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ─────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, displayName: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') return next(new Error('Account not active'));

      socket.userId = user.id;
      socket.user   = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.debug(`Socket connected: ${socket.id} for user ${userId}`);

    // Track user socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    // Mark online
    setUserOnline(userId, true);

    // ── Join swap rooms ─────────────────────────────────────
    socket.on('join:swap', async ({ swapId }) => {
      try {
        const swap = await prisma.swap.findFirst({
          where: {
            id: swapId,
            OR: [{ requesterId: userId }, { recipientId: userId }],
          },
        });
        if (swap) {
          socket.join(`swap:${swapId}`);
          logger.debug(`User ${userId} joined room swap:${swapId}`);
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to join swap room' });
      }
    });

    // ── Leave swap room ─────────────────────────────────────
    socket.on('leave:swap', ({ swapId }) => {
      socket.leave(`swap:${swapId}`);
    });

    // ── Send message ────────────────────────────────────────
    socket.on('message:send', async (data, ack) => {
      try {
        const { swapId, content, type = 'TEXT', fileUrl, fileName, fileSize, fileMimeType } = data;

        // Validate user is part of swap
        const swap = await prisma.swap.findFirst({
          where: {
            id: swapId,
            OR: [{ requesterId: userId }, { recipientId: userId }],
            status: { in: ['ACTIVE', 'PENDING'] },
          },
        });
        if (!swap) return ack?.({ error: 'Swap not found or inactive' });

        if (!content && !fileUrl) return ack?.({ error: 'Message content required' });
        if (content && content.length > 2000) return ack?.({ error: 'Message too long (max 2000 chars)' });

        const message = await prisma.message.create({
          data: {
            swapId,
            senderId: userId,
            type,
            content,
            fileUrl,
            fileName,
            fileSize,
            fileMimeType,
          },
          include: {
            sender: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        });

        // Update swap last activity
        await prisma.swap.update({
          where: { id: swapId },
          data: { lastActivityAt: new Date() },
        });

        // Emit to swap room (both parties)
        io.to(`swap:${swapId}`).emit('message:new', { message });

        // Push notification to partner (if they're not in the room)
        const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;
        const partnerInRoom = await isUserInRoom(partnerId, `swap:${swapId}`);
        if (!partnerInRoom) {
          const { notify } = require('../services/notification.service');
          await notify({
            userId: partnerId,
            type: 'MESSAGE_RECEIVED',
            title: `New message from ${socket.user.displayName}`,
            body: content ? content.substring(0, 100) : '📎 File attachment',
            data: { swapId, messageId: message.id },
          });
        }

        ack?.({ success: true, message });
      } catch (err) {
        logger.error('Socket message:send error', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    // ── Message read receipt ────────────────────────────────
    socket.on('message:read', async ({ swapId, messageId }) => {
      try {
        await prisma.message.updateMany({
          where: { id: messageId, swapId, senderId: { not: userId } },
          data: { readAt: new Date() },
        });
        io.to(`swap:${swapId}`).emit('message:read_receipt', { messageId, readBy: userId });
      } catch (err) {
        logger.error('Socket message:read error', err);
      }
    });

    // ── Typing indicator ────────────────────────────────────
    socket.on('typing:start', ({ swapId }) => {
      socket.to(`swap:${swapId}`).emit('typing:indicator', {
        swapId,
        userId,
        displayName: socket.user.displayName,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ swapId }) => {
      socket.to(`swap:${swapId}`).emit('typing:indicator', {
        swapId,
        userId,
        isTyping: false,
      });
    });

    // ── Message reaction ────────────────────────────────────
    socket.on('message:react', async ({ messageId, emoji, swapId }) => {
      try {
        const existing = await prisma.messageReaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
        });
        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
          io.to(`swap:${swapId}`).emit('message:reaction_removed', { messageId, userId, emoji });
        } else {
          await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
          io.to(`swap:${swapId}`).emit('message:reaction_added', { messageId, userId, emoji });
        }
      } catch (err) {
        logger.error('Socket message:react error', err);
      }
    });

    // ── Video call signalling ───────────────────────────────
    socket.on('call:invite', ({ swapId, targetUserId }) => {
      emitToUser(targetUserId, 'call:incoming', {
        swapId,
        callerId: userId,
        callerName: socket.user.displayName,
      });
    });

    socket.on('call:accept', ({ swapId, callerId }) => {
      emitToUser(callerId, 'call:accepted', { swapId, byUserId: userId });
    });

    socket.on('call:reject', ({ swapId, callerId }) => {
      emitToUser(callerId, 'call:rejected', { swapId, byUserId: userId });
    });

    socket.on('call:end', ({ swapId, partnerId }) => {
      emitToUser(partnerId, 'call:ended', { swapId, byUserId: userId });
    });

    // WebRTC signalling
    socket.on('webrtc:offer',     ({ targetId, offer })     => emitToUser(targetId, 'webrtc:offer',     { from: userId, offer }));
    socket.on('webrtc:answer',    ({ targetId, answer })    => emitToUser(targetId, 'webrtc:answer',    { from: userId, answer }));
    socket.on('webrtc:ice',       ({ targetId, candidate }) => emitToUser(targetId, 'webrtc:ice',       { from: userId, candidate }));

    // ── Disconnect ──────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          await setUserOnline(userId, false);
        }
      }
    });
  });

  return io;
}

// ── Emit to a specific user ───────────────────────────────────
function emitToUser(userId, event, data) {
  if (!io) return;
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
}

// ── Check if user is in a room ────────────────────────────────
async function isUserInRoom(userId, room) {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.rooms.has(room)) return true;
  }
  return false;
}

// ── Online status ─────────────────────────────────────────────
async function setUserOnline(userId, isOnline) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
    // Notify the user's swap partners of status change
    const swaps = await prisma.swap.findMany({
      where: {
        OR: [{ requesterId: userId }, { recipientId: userId }],
        status: 'ACTIVE',
      },
    });
    for (const swap of swaps) {
      const partnerId = swap.requesterId === userId ? swap.recipientId : swap.requesterId;
      emitToUser(partnerId, 'user:online_status', { userId, isOnline });
    }
  } catch (err) {
    logger.error('setUserOnline error', err);
  }
}

// ── Get IO instance ───────────────────────────────────────────
function getIO() { return io; }

module.exports = { initSocket, emitToUser, getIO };
