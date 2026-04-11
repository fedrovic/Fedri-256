'use strict';
// ═══════════════════════════════════════════════════
//  src/routes/user.routes.js
// ═══════════════════════════════════════════════════
const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/me',                        authenticate,             ctrl.getMe);
router.patch('/me',                      authenticate,             ctrl.updateProfile);
router.post('/me/avatar',                authenticate, upload.single('avatar'), ctrl.updateAvatar);
router.get('/me/notification-prefs',     authenticate,             ctrl.getNotificationPrefs);
router.patch('/me/notification-prefs',   authenticate,             ctrl.updateNotificationPrefs);
router.delete('/me',                     authenticate,             ctrl.deleteAccount);

router.post('/me/skills',                authenticate,             ctrl.addSkill);
router.patch('/me/skills/:skillId',      authenticate,             ctrl.updateSkill);
router.delete('/me/skills/:skillId',     authenticate,             ctrl.removeSkill);

router.post('/me/availability',          authenticate,             ctrl.setAvailability);

router.post('/block/:userId',            authenticate,             ctrl.blockUser);
router.delete('/block/:userId',          authenticate,             ctrl.unblockUser);

router.get('/:userId',                   optionalAuth,             ctrl.getProfile);
router.get('/:userId/reviews',           optionalAuth,             ctrl.getReviews);

module.exports = router;
