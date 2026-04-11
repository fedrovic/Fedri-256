'use strict';
// ═══════════════════════════════════════════════════
//  src/routes/session.routes.js
// ═══════════════════════════════════════════════════
const sRouter = require('express').Router();
const sCtrl   = require('../controllers/session.controller');
const { authenticate } = require('../middleware/auth');

sRouter.get('/upcoming',                    authenticate, sCtrl.getUpcomingSessions);
sRouter.post('/swap/:swapId',               authenticate, sCtrl.scheduleSession);
sRouter.get('/swap/:swapId',                authenticate, sCtrl.getSwapSessions);
sRouter.get('/:sessionId/join',             authenticate, sCtrl.joinSession);
sRouter.patch('/:sessionId/complete',       authenticate, sCtrl.completeSession);
sRouter.patch('/:sessionId/missed',         authenticate, sCtrl.reportMissed);
sRouter.patch('/:sessionId/reschedule',     authenticate, sCtrl.rescheduleSession);
sRouter.get('/calendar/:icsToken',                        sCtrl.getCalendarInvite);

module.exports = sRouter;
