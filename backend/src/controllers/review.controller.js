'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden, sendPaginated } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ── Submit a review ───────────────────────────────────────────
exports.createReview = async (req, res) => {
  const { swapId, rating, feedback, tags } = req.body;

  if (rating < 1 || rating > 5) {
    return sendBadRequest(res, 'Rating must be between 1 and 5');
  }

  // Verify the swap is completed and involves this user
  const swap = await prisma.swap.findFirst({
    where: {
      id: swapId,
      status: 'COMPLETED',
      OR: [{ requesterId: req.user.id }, { recipientId: req.user.id }],
    },
  });
  if (!swap) return sendNotFound(res, 'Completed swap');

  const revieweeId = swap.requesterId === req.user.id ? swap.recipientId : swap.requesterId;

  // Prevent duplicate reviews
  const existing = await prisma.review.findFirst({
    where: { swapId, reviewerId: req.user.id },
  });
  if (existing) return sendBadRequest(res, 'You have already reviewed this swap');

  const VALID_TAGS = [
    'Patient teacher', 'Well-prepared', 'Clear explanations',
    'Fast progress', 'Flexible scheduling', 'Great communicator',
    'Highly recommended', 'Deep knowledge', 'Real-world focus',
  ];
  const validTags = (tags || []).filter(t => VALID_TAGS.includes(t));

  const review = await prisma.$transaction(async (tx) => {
    // Create review
    const newReview = await tx.review.create({
      data: {
        swapId,
        reviewerId: req.user.id,
        revieweeId,
        rating,
        feedback: feedback?.trim(),
        tags: validTags,
      },
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
        reviewee: { select: { id: true, displayName: true } },
      },
    });

    // Recalculate reviewee's reputation score (weighted rolling avg)
    const reviews = await tx.review.findMany({
      where: { revieweeId, isPublic: true },
      select: { rating: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    let weightedSum = 0, totalWeight = 0;

    reviews.forEach(r => {
      const age = now - r.createdAt.getTime();
      const weight = age < NINETY_DAYS ? 1.5 : 1.0;
      weightedSum += r.rating * weight;
      totalWeight += weight;
    });

    const newScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

    await tx.user.update({
      where: { id: revieweeId },
      data: { reputationScore: newScore },
    });

    // Notify reviewee
    await tx.notification.create({
      data: {
        userId: revieweeId,
        type: 'REVIEW_RECEIVED',
        title: 'You received a new review!',
        body: `${req.user.displayName} left you a ${rating}-star review`,
        data: { swapId, reviewId: newReview.id },
      },
    });

    return newReview;
  });

  logger.info(`Review created for swap ${swapId} by ${req.user.id}`);
  return sendCreated(res, review, 'Review submitted. Thank you!');
};

// ── Respond to a review ───────────────────────────────────────
exports.respondToReview = async (req, res) => {
  const { reviewId } = req.params;
  const { response } = req.body;

  if (!response || response.trim().length > 200) {
    return sendBadRequest(res, 'Response must be between 1 and 200 characters');
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, revieweeId: req.user.id },
  });
  if (!review) return sendNotFound(res, 'Review');

  if (review.response) {
    return sendBadRequest(res, 'You have already responded to this review');
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { response: response.trim(), respondedAt: new Date() },
  });

  return sendSuccess(res, updated, 'Response posted');
};

// ── Get reviews for a user ────────────────────────────────────
exports.getUserReviews = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 10, sort = 'recent' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const orderBy = sort === 'highest' ? { rating: 'desc' }
                : sort === 'lowest'  ? { rating: 'asc' }
                : { createdAt: 'desc' };

  const [reviews, total, stats] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId, isPublic: true },
      orderBy,
      skip,
      take: parseInt(limit),
      include: {
        reviewer: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    }),
    prisma.review.count({ where: { revieweeId: userId, isPublic: true } }),
    prisma.review.aggregate({
      where: { revieweeId: userId, isPublic: true },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  // Star distribution
  const distribution = await prisma.review.groupBy({
    by: ['rating'],
    where: { revieweeId: userId, isPublic: true },
    _count: { rating: true },
  });

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach(d => { dist[d.rating] = d._count.rating; });

  return sendPaginated(res, reviews, page, limit, total, 'Reviews retrieved', {
    averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
    totalReviews: stats._count,
    distribution: dist,
  });
};

// ── Flag a review ─────────────────────────────────────────────
exports.flagReview = async (req, res) => {
  const { reviewId } = req.params;
  const { reason } = req.body;

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return sendNotFound(res, 'Review');

  await prisma.report.create({
    data: {
      reporterId: req.user.id,
      reportedId: review.reviewerId,
      targetType: 'review',
      targetId: reviewId,
      reason: reason || 'Inappropriate content',
    },
  });

  return sendSuccess(res, null, 'Review flagged for moderation review');
};
