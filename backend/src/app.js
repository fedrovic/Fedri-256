'use strict';

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const cookieParser = require('cookie-parser');
const passport    = require('passport');

const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const errorHandler  = require('./middleware/errorHandler');
const notFound      = require('./middleware/notFound');
const requestId     = require('./middleware/requestId');
const logger = require('./config/logger');

// Route imports
const authRoutes         = require('./routes/auth.routes');
const userRoutes         = require('./routes/user.routes');
const skillRoutes        = require('./routes/skill.routes');
const swapRoutes         = require('./routes/swap.routes');
const sessionRoutes      = require('./routes/session.routes');
const messageRoutes      = require('./routes/message.routes');
const reviewRoutes       = require('./routes/review.routes');
const coinRoutes         = require('./routes/coin.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes       = require('./routes/search.routes');
const adminRoutes        = require('./routes/admin.routes');
const webhookRoutes      = require('./routes/webhook.routes');

// Passport strategies
require('./config/passport');

const app = express();
const API = `/api/${process.env.API_VERSION || 'v1'}`;

// ── Security headers ──────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    }
  }
}));

// ── CORS ─────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Request-ID'],
}));
app.options('*', cors());

// ── Body parsing ─────────────────────────────────
// Webhook route needs raw body for Stripe signature verification
app.use(`${API}/webhooks`, express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ── Request ID ───────────────────────────────────
app.use(requestId);

// ── HTTP logging ─────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/health',
  }));
}

// ── Passport ─────────────────────────────────────
app.use(passport.initialize());

// ── Rate limiting ─────────────────────────────────
app.use(`${API}/auth`, authLimiter);
app.use(API, apiLimiter);

// ── Health check ─────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

// ── API Routes ───────────────────────────────────
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/users`,         userRoutes);
app.use(`${API}/skills`,        skillRoutes);
app.use(`${API}/swaps`,         swapRoutes);
app.use(`${API}/sessions`,      sessionRoutes);
app.use(`${API}/messages`,      messageRoutes);
app.use(`${API}/reviews`,       reviewRoutes);
app.use(`${API}/coins`,         coinRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/search`,        searchRoutes);
app.use(`${API}/admin`,         adminRoutes);
app.use(`${API}/webhooks`,      webhookRoutes);

// ── 404 & Error handlers ─────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
