'use strict';
// ═══════════════════════════════════════════════════
//  tests/integration/auth.test.js
// ═══════════════════════════════════════════════════

const request = require('supertest');
const app     = require('../../src/app');
const { prisma } = require('../../src/config/database');

const BASE = '/api/v1/auth';

describe('Auth API', () => {
  const testEmail = `test_${Date.now()}@skillswap.test`;
  const testPass  = 'TestPass123!';
  let accessToken;

  // ── POST /register ──────────────────────────────
  describe('POST /register', () => {
    it('should register a new user and return 201', async () => {
      const res = await request(app).post(`${BASE}/register`).send({
        email: testEmail, password: testPass, firstName: 'Test', lastName: 'User',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 409 for duplicate email', async () => {
      const res = await request(app).post(`${BASE}/register`).send({
        email: testEmail, password: testPass, firstName: 'Test', lastName: 'User',
      });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for invalid email', async () => {
      const res = await request(app).post(`${BASE}/register`).send({
        email: 'not-an-email', password: testPass, firstName: 'Test', lastName: 'User',
      });
      expect(res.status).toBe(422);
    });

    it('should return 422 for weak password', async () => {
      const res = await request(app).post(`${BASE}/register`).send({
        email: `new_${Date.now()}@test.com`, password: 'weak', firstName: 'Test', lastName: 'User',
      });
      expect(res.status).toBe(422);
    });
  });

  // ── POST /login ─────────────────────────────────
  describe('POST /login', () => {
    beforeAll(async () => {
      // Manually activate user for testing (skip email verification)
      await prisma.user.update({
        where: { email: testEmail },
        data: { status: 'ACTIVE', emailVerified: true },
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app).post(`${BASE}/login`).send({
        email: testEmail, password: testPass,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
      accessToken = res.body.data.accessToken;
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app).post(`${BASE}/login`).send({
        email: testEmail, password: 'wrongpassword123!',
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app).post(`${BASE}/login`).send({
        email: 'nobody@skillswap.test', password: testPass,
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /logout ────────────────────────────────
  describe('POST /logout', () => {
    it('should logout authenticated user', async () => {
      const res = await request(app)
        .post(`${BASE}/logout`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).post(`${BASE}/logout`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /forgot-password ────────────────────────
  describe('POST /forgot-password', () => {
    it('should always return 200 (prevent enumeration)', async () => {
      const res1 = await request(app).post(`${BASE}/forgot-password`).send({ email: testEmail });
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      const res2 = await request(app).post(`${BASE}/forgot-password`).send({ email: 'nobody@test.com' });
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
    });
  });

  // ── Cleanup ──────────────────────────────────────
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@skillswap.test' } } });
  });
});


// ═══════════════════════════════════════════════════
//  tests/unit/jwt.test.js
// ═══════════════════════════════════════════════════
describe('JWT utilities', () => {
  process.env.JWT_ACCESS_SECRET  = 'test_access_secret_that_is_long_enough_for_testing';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_long_enough_for_testing';
  process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';

  const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../../src/utils/jwt');

  it('should sign and verify an access token', () => {
    const token = signAccessToken({ sub: 'user-123' });
    expect(typeof token).toBe('string');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('should sign and verify a refresh token', () => {
    const token = signRefreshToken({ sub: 'user-456' });
    expect(typeof token).toBe('string');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('user-456');
  });

  it('should throw on invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });
});


// ═══════════════════════════════════════════════════
//  tests/unit/apiError.test.js
// ═══════════════════════════════════════════════════
describe('ApiError', () => {
  const { ApiError } = require('../../src/utils/ApiError');

  it('should create an error with correct statusCode and message', () => {
    const err = new ApiError(404, 'Not found', 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });

  it('should be an instance of Error', () => {
    const err = new ApiError(500, 'Server error');
    expect(err instanceof Error).toBe(true);
  });
});
