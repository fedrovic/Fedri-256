'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/review.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.post('/',                       authenticate, ctrl.createReview);
router.patch('/:reviewId/respond',     authenticate, ctrl.respondToReview);
router.post('/:reviewId/flag',         authenticate, ctrl.flagReview);
router.get('/user/:userId',            optionalAuth, ctrl.getUserReviews);

module.exports = router;
