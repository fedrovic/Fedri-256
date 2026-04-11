'use strict';

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.user?.role === 'ADMIN',
  message: {
    success: false,
    error: { message: 'Too many requests — please slow down.', code: 'RATE_LIMIT_EXCEEDED' },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 20,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: { message: 'Too many auth attempts. Please wait 15 minutes.', code: 'AUTH_RATE_LIMIT' },
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: {
    success: false,
    error: { message: 'Upload rate limit exceeded', code: 'UPLOAD_RATE_LIMIT' },
  },
});

module.exports = { apiLimiter, authLimiter, uploadLimiter };
