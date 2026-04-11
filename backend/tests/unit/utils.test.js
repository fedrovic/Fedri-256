'use strict';
// ════════════════════════════════════════════════════════════════
//  tests/unit/utils.test.js
//  Unit tests for pure utility functions (no DB required)
// ════════════════════════════════════════════════════════════════

// ── JWT utils ─────────────────────────────────────────────────
describe('JWT utils', () => {
  // Set up env before requiring the module
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET  = 'test_access_secret_at_least_32_chars_long';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_chars_long';
    process.env.JWT_ACCESS_EXPIRES_IN  = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
  });

  const { signAccessToken, signRefreshToken, verifyAccessToken } = require('../../src/utils/jwt');

  it('signs and verifies an access token', () => {
    const payload = { sub: 'user-123', email: 'test@example.com', role: 'USER' };
    const token   = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT structure
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
  });

  it('throws on tampered token', () => {
    const token   = signAccessToken({ sub: 'user-456' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('creates distinct access and refresh tokens for same payload', () => {
    const payload = { sub: 'user-789' };
    const access  = signAccessToken(payload);
    const refresh = signRefreshToken(payload);
    expect(access).not.toBe(refresh);
  });
});

// ── OTP utils ─────────────────────────────────────────────────
describe('OTP utils', () => {
  const { generateOTP, hashOTP, verifyOTP } = require('../../src/utils/otp');

  it('generates an OTP of correct length', () => {
    const otp6 = generateOTP(6);
    const otp8 = generateOTP(8);
    expect(otp6.length).toBe(6);
    expect(otp8.length).toBe(8);
  });

  it('generates unique OTPs', () => {
    const otps = new Set(Array.from({ length: 100 }, () => generateOTP(8)));
    // Should be very unlikely to have duplicates in 100 attempts
    expect(otps.size).toBeGreaterThan(90);
  });

  it('hashes and verifies an OTP correctly', async () => {
    const otp  = generateOTP(8);
    const hash = await hashOTP(otp);
    expect(await verifyOTP(otp, hash)).toBe(true);
    expect(await verifyOTP('WRONGOTP', hash)).toBe(false);
  });
});

// ── ApiResponse utils ─────────────────────────────────────────
describe('apiResponse utils', () => {
  const {
    sendSuccess, sendCreated, sendError, sendNotFound,
    sendUnauthorized, sendForbidden, sendBadRequest, sendPaginated,
  } = require('../../src/utils/apiResponse');

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  };

  it('sendSuccess returns 200 with success:true', () => {
    const res = mockRes();
    sendSuccess(res, { id: 1 }, 'Done');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Done', data: { id: 1 } }));
  });

  it('sendCreated returns 201', () => {
    const res = mockRes();
    sendCreated(res, { id: 2 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sendError returns correct status code', () => {
    const res = mockRes();
    sendError(res, 'Oops', 503);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('sendNotFound returns 404', () => {
    const res = mockRes();
    sendNotFound(res, 'User');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sendUnauthorized returns 401', () => {
    const res = mockRes();
    sendUnauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sendPaginated includes correct meta', () => {
    const res = mockRes();
    sendPaginated(res, [1, 2, 3], 2, 10, 45);
    const call = res.json.mock.calls[0][0];
    expect(call.meta.page).toBe(2);
    expect(call.meta.total).toBe(45);
    expect(call.meta.totalPages).toBe(5);
    expect(call.meta.hasNextPage).toBe(true);
    expect(call.meta.hasPrevPage).toBe(true);
  });
});

// ── ApiError class ────────────────────────────────────────────
describe('ApiError class', () => {
  const { ApiError } = require('../../src/utils/ApiError');

  it('creates error with statusCode and message', () => {
    const err = new ApiError(404, 'Not found', 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('captures stack trace', () => {
    const err = new ApiError(500, 'Oops');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ApiError');
  });

  it('accepts optional details array', () => {
    const details = [{ field: 'email', message: 'Invalid' }];
    const err = new ApiError(422, 'Validation failed', 'VALIDATION_ERROR', details);
    expect(err.details).toEqual(details);
  });
});

// ── Middleware: validate ───────────────────────────────────────
describe('validate middleware', () => {
  const { z } = require('zod');
  const { validate } = require('../../src/middleware/validate');
  const { ApiError } = require('../../src/utils/ApiError');

  const schema = z.object({
    body: z.object({
      name:  z.string().min(1),
      email: z.string().email(),
    }),
  });

  it('calls next() when validation passes', () => {
    const req  = { body: { name: 'Alice', email: 'alice@test.com' }, query: {}, params: {} };
    const res  = {};
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  it('calls next(ApiError) when validation fails', () => {
    const req  = { body: { name: '', email: 'bad' }, query: {}, params: {} };
    const res  = {};
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
  });
});

// ── Middleware: requestId ─────────────────────────────────────
describe('requestId middleware', () => {
  const requestId = require('../../src/middleware/requestId');

  it('generates UUID and sets header when no x-request-id present', () => {
    const req = { headers: {} };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();
    requestId(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('uses existing x-request-id header if present', () => {
    const req  = { headers: { 'x-request-id': 'my-custom-id' } };
    const res  = { setHeader: jest.fn() };
    const next = jest.fn();
    requestId(req, res, next);
    expect(req.id).toBe('my-custom-id');
  });
});
