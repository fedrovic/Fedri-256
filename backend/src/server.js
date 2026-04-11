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
        await disconnectDB();
        await disconnectRedis();
        logger.info('Connections closed. Goodbye 👋');
        process.exit(0);
      });
      setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
