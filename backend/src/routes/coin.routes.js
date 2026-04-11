'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/coin.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/wallet',      ctrl.getWallet);
router.post('/spend',      ctrl.spendCoins);
router.post('/purchase',   ctrl.purchaseCoins);
router.post('/transfer',   ctrl.transferCoins);

module.exports = router;
