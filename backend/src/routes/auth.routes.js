// ═══════════════════════════════════════════════════
//  AUTH ROUTES  —  src/routes/auth.routes.js
// ═══════════════════════════════════════════════════
'use strict';
const router   = require('express').Router();
const passport = require('passport');
const ctrl     = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate }     = require('../middleware/validate');
const { authLimiter }  = require('../middleware/rateLimiter');
const v = require('../validators/auth.validator');

// Email/password
router.post('/register',        validate(v.register),        ctrl.register);
router.post('/login',           validate(v.login),           ctrl.login);
router.post('/logout',          authenticate,                ctrl.logout);
router.post('/refresh-token',                                ctrl.refreshToken);
router.post('/verify-email',    validate(v.verifyEmail),     ctrl.verifyEmail);
router.post('/forgot-password', validate(v.forgotPassword),  ctrl.forgotPassword);
router.post('/reset-password',  validate(v.resetPassword),   ctrl.resetPassword);

// 2FA
router.post('/2fa/verify',      validate(v.verify2FA),       ctrl.verifyTwoFactor);
router.post('/2fa/setup',       authenticate,                ctrl.setupTwoFactor);
router.post('/2fa/confirm',     authenticate, validate(v.confirm2FA), ctrl.confirmTwoFactor);

// OAuth — Google
router.get('/google',          passport.authenticate('google', { scope: ['profile','email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), ctrl.oauthCallback);

// OAuth — GitHub
router.get('/github',          passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false }), ctrl.oauthCallback);

module.exports = router;


// ═══════════════════════════════════════════════════
//  SWAP ROUTES  —  src/routes/swap.routes.js
// ═══════════════════════════════════════════════════
// (separate file in practice — included here for conciseness)
const swapRouter = require('express').Router();
const swapCtrl   = require('../controllers/swap.controller');
const { authenticate: auth } = require('../middleware/auth');

swapRouter.use(auth);
swapRouter.post('/',                         swapCtrl.createSwap);
swapRouter.get('/',                          swapCtrl.getMySwaps);
swapRouter.get('/:swapId',                   swapCtrl.getSwap);
swapRouter.patch('/:swapId/accept',          swapCtrl.acceptSwap);
swapRouter.patch('/:swapId/decline',         swapCtrl.declineSwap);
swapRouter.patch('/:swapId/counter',         swapCtrl.counterPropose);
swapRouter.patch('/:swapId/pause',           swapCtrl.pauseSwap);
swapRouter.patch('/:swapId/resume',          swapCtrl.resumeSwap);
swapRouter.patch('/:swapId/cancel',          swapCtrl.cancelSwap);
swapRouter.patch('/:swapId/complete',        swapCtrl.completeSwap);
swapRouter.post('/:swapId/dispute',          swapCtrl.openDispute);

// module.exports = swapRouter; // uncomment in actual separate file
