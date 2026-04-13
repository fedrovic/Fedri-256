'use strict';

require('dotenv').config();
require('express-async-errors');

const http    = require('http');
const app     = require('./app');
const { initSocket } = require('./sockets');
const { connectRedis } = require('./config/redis');
const { connectDB }    = require('./config/database');
const logger  = require('./config/logger');
const { startJobs } = require('./jobs');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // 1. Connect database
    await connectDB();
    logger.info('✅ PostgreSQL connected');

    // 2. Connect Redis
    await connectRedis();
    logger.info('✅ Redis connected');

    // 3. Create HTTP server
    const server = http.createServer(app);

    // 4. Attach Socket.IO
    initSocket(server);
    logger.info('✅ Socket.IO initialised');

    // 5. Start background jobs
    startJobs();
    logger.info('✅ Background jobs started');

    // 6. Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 SkillSwap API running on port ${PORT} [${process.env.NODE_ENV}]`);
      logger.info(`📖 API Docs: http://localhost:${PORT}/api/v1/docs`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        const { disconnectDB } = require('./config/database');
        const { disconnectRedis } = require('./config/redis');
        try {
          await disconnectDB();
          await disconnectRedis();
          logger.info('Connections closed. Goodbye 👋');
          process.exitCode = 0;
        } catch (cleanupErr) {
          logger.error('Error during shutdown cleanup:', cleanupErr);
          process.exitCode = 1;
        }
      });

      // If cleanup doesn't complete within the timeout, mark the exit code
      // and allow the process supervisor/container to handle termination.
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exitCode = 1;
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server:', err);
    // Set non-zero exit code so supervisors/CI detect failure. Avoid
    // immediate process.exit() to give runtime a chance to flush logs.
    process.exitCode = 1;
    // Ensure the process eventually exits if not handled externally.
    setTimeout(() => {
      logger.error('Exiting after startup failure');
      process.exit(1);
    }, 5000);
  }
}

bootstrap();
