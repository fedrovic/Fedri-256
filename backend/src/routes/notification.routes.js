'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/',                      ctrl.getNotifications);
router.get('/unread-count',          ctrl.getUnreadCount);
router.patch('/read-all',            ctrl.markAllRead);
router.patch('/:notificationId',     ctrl.markRead);
router.delete('/:notificationId',    ctrl.deleteNotification);

module.exports = router;
