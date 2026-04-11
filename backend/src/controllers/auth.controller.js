'use strict';

const bcrypt    = require('bcryptjs');
const speakeasy = require('speakeasy');
const { v4: uuidv4 } = require('uuid');

const { prisma }            = require('../config/database');
const { client: redis }     = require('../config/redis');
const logger                = require('../config/logger');
const { ApiError }          = require('../utils/ApiError');
const { sendEmail }         = require('../services/email.service');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { setCookies, clearCookies } = require('../utils/cookies');
const { generateOTP, hashOTP, verifyOTP } = require('../utils/otp');
const { awardBadgeIfEligible } = require('../services/badge.service');
const { PLAN_LIMITS }       = require('../config/constants');

// ── Register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { email, password, firstName, lastName, marketingOptIn } = req.body;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email:         email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      displayName:   `${firstName} ${lastName}`.trim(),
      marketingOptIn: marketingOptIn || false,
      status:        'PENDING_VERIFICATION',
    },
    select: { id: true, email: true, displayName: true, createdAt: true },
  });

  // Email OTP
  const otp     = generateOTP(8);
  const otpHash = await hashOTP(otp);
  await prisma.passwordReset.create({
    data: { userId: user.id, otp: otpHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  await sendEmail({ to: user.email, template: 'email-verification', data: { name: firstName, token: otp, expiresInMinutes: 10 } });

  // Welcome coins
  await prisma.$transaction([
    prisma.coinTransaction.create({ data: { userId: user.id, type: 'BONUS', amount: 3, balanceAfter: 3, description: 'Welcome bonus' } }),
    prisma.user.update({ where: { id: user.id }, data: { coinBalance: 3 } }),
  ]);

  logger.info(`New user registered: ${user.email}`);

  const { accessToken, refreshToken } = await issueTokens(user.id, false);
  setCookies(res, refreshToken, false);

  res.status(201).json({ success: true, message: 'Account created. Check your email to verify.', data: { user, accessToken } });
};

// ── Login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, passwordHash: true, displayName: true, status: true, isTwoFactorEnabled: true, role: true, isPremium: true, avatarUrl: true, coinBalance: true, emailVerified: true },
  });

  if (!user || !user.passwordHash) throw new ApiError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await trackFailedLogin(email.toLowerCase(), req.ip);
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.status === 'BANNED')    throw new ApiError(403, 'Account banned. Contact support.');
  if (user.status === 'SUSPENDED') throw new ApiError(403, 'Account temporarily suspended.');

  if (user.isTwoFactorEnabled) {
    const tempToken = uuidv4();
    if (redis) await redis.setex(`2fa:${tempToken}`, 300, user.id);
    return res.json({ success: true, requiresTwoFactor: true, tempToken });
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, rememberMe);
  setCookies(res, refreshToken, rememberMe);
  await updateLastActive(user.id);

  const { passwordHash: _pw, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, accessToken } });
};

// ── Verify 2FA ────────────────────────────────────────────────
exports.verifyTwoFactor = async (req, res) => {
  const { tempToken, code } = req.body;
  if (!redis) throw new ApiError(503, 'Auth service unavailable');
  const userId = await redis.get(`2fa:${tempToken}`);
  if (!userId)  throw new ApiError(400, 'Two-factor session expired');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, twoFactorSecret: true, displayName: true, role: true, isPremium: true, avatarUrl: true, coinBalance: true } });
  if (!user?.twoFactorSecret) throw new ApiError(400, 'Two-factor not configured');

  const valid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 1 });
  if (!valid) throw new ApiError(401, 'Invalid two-factor code');

  await redis.del(`2fa:${tempToken}`);
  const { accessToken, refreshToken } = await issueTokens(user.id, false);
  setCookies(res, refreshToken, false);

  const { twoFactorSecret: _s, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, accessToken } });
};

// ── Verify Email ──────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const { token } = req.body;
  const records   = await prisma.passwordReset.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 200 });

  let matched = null;
  for (const r of records) { if (await verifyOTP(token, r.otp)) { matched = r; break; } }
  if (!matched) throw new ApiError(400, 'Invalid or expired verification code');

  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: matched.userId }, data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' } }),
  ]);

  res.json({ success: true, message: 'Email verified. You can now sign in.' });
};

// ── Forgot Password ───────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });

  const otp = generateOTP(8);
  await prisma.passwordReset.create({ data: { userId: user.id, otp: await hashOTP(otp), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  await sendEmail({ to: user.email, template: 'password-reset', data: { name: user.firstName || user.displayName, token: otp, expiresInMinutes: 10 } });

  res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
};

// ── Reset Password ────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  const records = await prisma.passwordReset.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 200 });

  let matched = null;
  for (const r of records) { if (await verifyOTP(token, r.otp)) { matched = r; break; } }
  if (!matched) throw new ApiError(400, 'Invalid or expired reset code');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: matched.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: matched.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId: matched.userId }, data: { revokedAt: new Date() } }),
  ]);

  res.json({ success: true, message: 'Password reset. Please log in.' });
};

// ── Refresh Token ─────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) throw new ApiError(401, 'Refresh token required');

  let payload;
  try { payload = verifyRefreshToken(token); } catch { throw new ApiError(401, 'Invalid or expired refresh token'); }

  const stored = await prisma.refreshToken.findFirst({ where: { token, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
  if (!stored) throw new ApiError(401, 'Refresh token revoked');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, status: true } });
  if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') throw new ApiError(401, 'Account not active');

  const { accessToken, refreshToken: newRefresh } = await issueTokens(user.id, false);
  setCookies(res, newRefresh, false);
  res.json({ success: true, data: { accessToken } });
};

// ── Logout ────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) await prisma.refreshToken.updateMany({ where: { token, userId: req.user.id }, data: { revokedAt: new Date() } });
  clearCookies(res);
  res.json({ success: true, message: 'Logged out successfully' });
};

// ── Setup 2FA ─────────────────────────────────────────────────
exports.setupTwoFactor = async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `SkillSwap:${req.user.email}`, issuer: 'SkillSwap' });
  if (redis) await redis.setex(`2fa_setup:${req.user.id}`, 600, secret.base32);
  else await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorSecret: secret.base32 } });
  res.json({ success: true, data: { secret: secret.base32, otpauthUrl: secret.otpauth_url } });
};

// ── Confirm 2FA ───────────────────────────────────────────────
exports.confirmTwoFactor = async (req, res) => {
  const { code } = req.body;
  let secret = redis ? await redis.get(`2fa_setup:${req.user.id}`) : null;
  if (!secret) {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { twoFactorSecret: true } });
    secret = u?.twoFactorSecret;
  }
  if (!secret) throw new ApiError(400, 'Setup session expired. Please start again.');

  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
  if (!valid) throw new ApiError(400, 'Invalid code');

  await prisma.user.update({ where: { id: req.user.id }, data: { isTwoFactorEnabled: true, twoFactorSecret: secret } });
  if (redis) await redis.del(`2fa_setup:${req.user.id}`);
  res.json({ success: true, message: 'Two-factor authentication enabled.' });
};

// ── OAuth callback ────────────────────────────────────────────
exports.oauthCallback = async (req, res) => {
  try {
    if (!req.user) throw new ApiError(401, 'OAuth failed');
    const { accessToken, refreshToken } = await issueTokens(req.user.id, false);
    setCookies(res, refreshToken, false);
    const fe = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${fe}/skillswap-auth.html?token=${accessToken}`);
  } catch (err) {
    const fe = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${fe}/skillswap-auth.html?error=${encodeURIComponent(err.message)}`);
  }
};

// ── Helpers ───────────────────────────────────────────────────
async function issueTokens(userId, rememberMe) {
  const accessToken  = signAccessToken({ sub: userId });
  const refreshToken = signRefreshToken({ sub: userId });
  await prisma.refreshToken.create({ data: { userId, token: refreshToken, expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 86_400_000) } });
  return { accessToken, refreshToken };
}

async function updateLastActive(userId) {
  await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }).catch(() => {});
}

async function trackFailedLogin(email, ip) {
  if (!redis) return;
  const key = `login_fails:${ip}`;
  const fails = await redis.incr(key);
  if (fails === 1) await redis.expire(key, 900);
  if (fails >= 5) { logger.warn(`Lockout: ${email} from ${ip}`); throw new ApiError(429, 'Too many failed attempts. Wait 15 minutes.'); }
}
