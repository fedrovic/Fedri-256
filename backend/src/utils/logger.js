'use strict';

const winston = require('winston');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const fmt = winston.format.printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level}]: ${stack || message}`
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isProd ? winston.format.json() : fmt
  ),
  transports: [
    new winston.transports.Console({
      silent: isTest,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        fmt
      ),
    }),
  ],
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = { write: (msg) => logger.http(msg.trim()) };

module.exports = logger;
