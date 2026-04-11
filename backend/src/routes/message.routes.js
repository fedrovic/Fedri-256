'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.get('/inbox',                                     authenticate, ctrl.getInbox);
router.get('/:swapId',                                   authenticate, ctrl.getMessages);
router.post('/:swapId',                                  authenticate, uploadLimiter, upload.single('attachment'), ctrl.sendMessage);
router.patch('/:swapId/:messageId',                      authenticate, ctrl.editMessage);
router.delete('/:swapId/:messageId',                     authenticate, ctrl.deleteMessage);
router.post('/:swapId/:messageId/react',                 authenticate, ctrl.addReaction);
router.delete('/:swapId/:messageId/react/:emoji',        authenticate, ctrl.removeReaction);
router.post('/:swapId/:messageId/report',                authenticate, ctrl.reportMessage);

module.exports = router;
