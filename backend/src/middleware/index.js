'use strict';
// ═══════════════════════════════════════════════════════════════
//  MIDDLEWARE COLLECTION — SkillSwap
// ═══════════════════════════════════════════════════════════════

const rateLimit = require('express-rate-limit');
const { validationResult } = require('express-validator');
const { v4: uuidv4 }       = require('uuid');
const logger               = require('../utils/logger');
const { sendBadRequest, sendError } = require('../utils/apiResponse');

// ── Rate limiters ──────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => sendError(res, 'Too many requests. Please slow down.', 429),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => sendError(res, 'Too many authentication attempts. Try again in 15 minutes.', 429),
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => sendError(res, 'Sending messages too quickly. Please wait a moment.', 429),
});

// ── Request ID ─────────────────────────────────────────────────
const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

// ── Validation middleware ──────────────────────────────────────
const validate = (schema) => async (req, res, next) => {
  // Run all validators
  await Promise.all(schema.map(validator => validator.run(req)));

  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map(e => ({
    field: e.path,
    message: e.msg,
  }));

  return sendBadRequest(res, 'Validation failed', formatted);
};

// ── 404 handler ────────────────────────────────────────────────
const notFound = (req, res) => {
  return sendError(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );
};

// ── Global error handler ───────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // Known application errors
  if (err.name === 'ApiError' || err.statusCode) {
    return sendError(res, err.message, err.statusCode || 400);
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    return sendError(res, `A record with this ${field} already exists`, 409);
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return sendError(res, 'Record not found', 404);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'File too large. Maximum size is 10MB.', 413);
  }

  // Unhandled — log and return generic error
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.originalUrl,
    method: req.method,
  });

  return sendError(
    res,
    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    500
  );
};

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
  requestId,
  validate,
  notFound,
  errorHandler,
};
