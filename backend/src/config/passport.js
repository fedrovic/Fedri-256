'use strict';

const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const JwtStrategy    = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const { prisma } = require('./database');
const logger         = require('./logger');

async function findOrCreateOAuthUser({ provider, providerId, email, profile, accessToken, refreshToken }) {
  const normalizedEmail = email ? email.toLowerCase() : null;

  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });
  if (existingAccount?.user) return existingAccount.user;

  let user = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail } }) : null;

  if (!user) {
    if (!normalizedEmail) throw new Error(`${provider} did not provide an email address`);

    const displayName = profile?.displayName || normalizedEmail.split('@')[0];
    const firstName = profile?.name?.givenName || null;
    const lastName = profile?.name?.familyName || null;
    const avatarUrl = profile?.photos?.[0]?.value || null;

    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName,
        firstName,
        lastName,
        avatarUrl,
        emailVerified: true,
        status: 'ACTIVE',
        skillCoinBalance: 3,
      },
    });

    await prisma.coinTransaction.create({
      data: {
        userId: user.id,
        type: 'BONUS',
        amount: 3,
        balanceAfter: 3,
        description: 'Welcome bonus - OAuth signup',
      },
    });

    logger.info(`New OAuth user created via ${provider}: ${normalizedEmail}`);
  } else if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });
  }

  await prisma.oAuthAccount.upsert({
    where: { provider_providerId: { provider, providerId } },
    create: {
      userId: user.id,
      provider,
      providerId,
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
    },
    update: {
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
    },
  });

  return user;
}

// ── JWT strategy (used internally by authenticate middleware) ──
passport.use('jwt', new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_ACCESS_SECRET || 'dev_secret',
    issuer: 'skillswap.io',
  },
  async (payload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, status: true, displayName: true },
      });
      if (!user || user.status !== 'ACTIVE') return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }
));

// ── Google OAuth 2.0 ──────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
      passReqToCallback: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'No email provided by Google' });

        const user = await findOrCreateOAuthUser({
          provider: 'google',
          providerId: profile.id,
          email,
          profile,
          accessToken,
          refreshToken,
        });

        return done(null, user);
      } catch (err) {
        logger.error('Google OAuth error', { error: err.message });
        return done(err, false);
      }
    }
  ));
} else {
  logger.warn('Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}

// ── GitHub OAuth 2.0 ──────────────────────────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use('github', new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/github/callback',
      scope: ['user:email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: 'No email provided by GitHub' });

        const user = await findOrCreateOAuthUser({
          provider: 'github',
          providerId: profile.id,
          email,
          profile,
          accessToken,
          refreshToken,
        });

        return done(null, user);
      } catch (err) {
        logger.error('GitHub OAuth error', { error: err.message });
        return done(err, false);
      }
    }
  ));
} else {
  logger.warn('GitHub OAuth not configured — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
}

module.exports = passport;
