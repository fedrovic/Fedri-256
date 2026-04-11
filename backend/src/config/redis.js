'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

let client = null;

const connectRedis = async () => {
  client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    lazyConnect: true,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error',   (err) => logger.error('Redis error', { message: err.message }));
  client.on('close',   () => logger.warn('Redis connection closed'));

  await client.connect();
  return client;
};

const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    client = null;
  }
};

// Expose client directly (needed by auth.controller and sockets)
const getClient = () => client;

// Cache helpers
const cache = {
  async get(key) {
    if (!client) return null;
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  },
  async set(key, value, ttlSeconds = 300) {
    if (!client) return;
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  },
  async del(key) {
    if (!client) return;
    await client.del(key);
  },
  async delPattern(pattern) {
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(...keys);
  },
  async incr(key, ttlSeconds = 900) {
    if (!client) return 0;
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, ttlSeconds);
    return count;
  },
};

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedis: getClient,
  cache,
  // Expose .client as a getter so `require('../config/redis').client` works
  get client() { return client; },
};
