'use strict';

const logger = require('../config/logger');

/**
 * Create a notification in DB and push it real-time to the user via Socket.IO
 */
const notify = async ({ userId, type, title, body, data = {} }) => {
  try {
    const { prisma }     = require('../config/database');
    const { emitToUser } = require('../sockets');

    const notification = await prisma.notification.create({
      data: { userId, type, title, body, data },
    });

    // Push real-time if user is connected
    emitToUser(userId, 'notification:new', notification);

    return notification;
  } catch (err) {
    logger.error('notify() failed', { error: err.message, userId, type });
    return null;
  }
};

module.exports = { notify };
