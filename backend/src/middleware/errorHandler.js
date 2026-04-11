'use strict';

const logger   = require('../config/logger');
const { ApiError } = require('../utils/ApiError');

/**
 * Global Express error handler — must be last middleware in chain
 */
const errorHandler = (err, req, res, next) => {
  // Prisma: unique constraint
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'value';
    return res.status(409).json({
      success: false,
      error: { message: `A record with this ${field} already exists`, code: 'DUPLICATE_ENTRY' },
    });
  }

  // Prisma: record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { message: 'Record not found', code: 'NOT_FOUND' },
    });
  }

  // Prisma: foreign key constraint
  if (err.code === 'P2003') {
    return res.status(400).json({
      success: false,
      error: { message: 'Related record not found', code: 'FOREIGN_KEY_VIOLATION' },
    });
  }

  // Known API errors
  if (err instanceof ApiError || err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: {
        message: err.message,
        code:    err.code || 'API_ERROR',
        ...(err.details && { details: err.details }),
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: { message: 'Invalid token', code: 'INVALID_TOKEN' } });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: { message: 'Token expired', code: 'TOKEN_EXPIRED' } });
  }

  // Multer file size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: { message: 'File too large. Maximum 10MB.', code: 'FILE_TOO_LARGE' } });
  }

  // Unknown / unexpected
  logger.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    path:    req.originalUrl,
    method:  req.method,
    requestId: req.id,
  });

  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    error: {
      message: isDev ? err.message : 'Internal server error',
      code:    'INTERNAL_ERROR',
      ...(isDev && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;
