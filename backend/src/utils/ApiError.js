'use strict';

class ApiError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.name       = 'ApiError';
    this.statusCode = statusCode;
    this.code       = code;
    this.details    = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiError };
