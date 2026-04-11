'use strict';

const jwt          = require('jsonwebtoken');
const { prisma }   = require('../config/database');
const { ApiError } = require('../utils/ApiError');
const logger       = require('../config/logger');

// ── Authenticate — verifies Bearer JWT, attaches req.user ─────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Access token required');

    const token   = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, email: true, role: true, isPremium: true, status: true, displayName: true, avatarUrl: true, coinBalance: true },
    });

    if (!user)                   throw new ApiError(401, 'User not found');
    if (user.status === 'BANNED')    throw new ApiError(403, 'Account banned');
    if (user.status === 'SUSPENDED') throw new ApiError(403, 'Account suspended');

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (err.name === 'TokenExpiredError') return next(new ApiError(401, 'Access token expired'));
    if (err.name === 'JsonWebTokenError') return next(new ApiError(401, 'Invalid access token'));
    next(err);
  }
};

// ── Optional auth — attaches user if token present ────────────
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const token   = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user    = await prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, email: true, role: true, isPremium: true, status: true },
    });
    if (user?.status === 'ACTIVE') req.user = user;
  } catch {}
  next();
};

// ── Role guard — use after authenticate ───────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user)                    return next(new ApiError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'Insufficient permissions'));
  next();
};

// ── Premium guard ─────────────────────────────────────────────
const requirePremium = (req, res, next) => {
  if (!req.user?.isPremium) return next(new ApiError(403, 'Premium subscription required'));
  next();
};

// ── Email verified guard ──────────────────────────────────────
const requireEmailVerified = (req, res, next) => {
  if (!req.user?.emailVerified) return next(new ApiError(403, 'Please verify your email first'));
  next();
};

module.exports = { authenticate, optionalAuth, requireRole, requirePremium, requireEmailVerified };
