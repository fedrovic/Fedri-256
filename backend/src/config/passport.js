'use strict';

const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy    = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const { prisma } = require('./database');
const logger         = require('./logger');

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

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              googleId:     profile.id,
              displayName:  profile.displayName || email.split('@')[0],
              firstName:    profile.name?.givenName,
              lastName:     profile.name?.familyName,
              avatarUrl:    profile.photos?.[0]?.value,
              emailVerified: true,
              status:       'ACTIVE',
              coinBalance:  3, // welcome bonus
            },
          });
          // Record welcome coin transaction
          await prisma.coinTransaction.create({
            data: {
              userId:      user.id,
              type:        'BONUS',
              amount:      3,
              balanceAfter: 3,
              description: 'Welcome bonus — start learning!',
            },
          });
          logger.info(`New OAuth user created: ${email}`);
        } else if (!user.googleId) {
          // Link Google to existing account
          await prisma.user.update({
            where: { id: user.id },
            data:  { googleId: profile.id, emailVerified: true },
          });
        }

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

module.exports = passport;
