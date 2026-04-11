'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

exports.getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    userId: req.user.id,
    ...(unreadOnly === 'true' && { isRead: false }),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
  ]);

  return sendPaginated(res, notifications, page, limit, total, 'Notifications retrieved');
};

exports.markRead = async (req, res) => {
  const { notificationId } = req.params;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: req.user.id },
    data: { isRead: true, readAt: new Date() },
  });

  return sendSuccess(res, null, 'Notification marked as read');
};

exports.markAllRead = async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return sendSuccess(res, null, 'All notifications marked as read');
};

exports.getUnreadCount = async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  return sendSuccess(res, { count });
};

exports.deleteNotification = async (req, res) => {
  const { notificationId } = req.params;
  await prisma.notification.deleteMany({
    where: { id: notificationId, userId: req.user.id },
  });
  return sendSuccess(res, null, 'Notification deleted');
};
