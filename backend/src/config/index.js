require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  apiVersion: process.env.API_VERSION || 'v1',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  },

  redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },

  email: {
    apiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@skillswap.io',
    fromName: process.env.EMAIL_FROM_NAME || 'SkillSwap',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
  },

  storage: {
    bucket: process.env.R2_BUCKET_NAME || 'skillswap-media',
    publicUrl: process.env.R2_PUBLIC_URL || 'https://media.skillswap.io',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  bcrypt: { saltRounds: 12 },
  coins: { earnPerSession: 1, bonusOnSignup: 3 },
  swap: { maxActiveForFree: 3, autoArchiveDays: 45 },
};

module.exports = config;
