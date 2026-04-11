'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/swap.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/',                     ctrl.createSwap);
router.get('/',                      ctrl.getMySwaps);
router.get('/:swapId',               ctrl.getSwap);
router.patch('/:swapId/accept',      ctrl.acceptSwap);
router.patch('/:swapId/decline',     ctrl.declineSwap);
router.patch('/:swapId/counter',     ctrl.counterPropose);
router.patch('/:swapId/pause',       ctrl.pauseSwap);
router.patch('/:swapId/resume',      ctrl.resumeSwap);
router.patch('/:swapId/cancel',      ctrl.cancelSwap);
router.patch('/:swapId/complete',    ctrl.completeSwap);
router.post('/:swapId/dispute',      ctrl.openDispute);

module.exports = router;
