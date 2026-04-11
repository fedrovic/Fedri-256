'use strict';
// ════════════════════════════════════════════════════════════════
//  tests/integration/swap.test.js
// ════════════════════════════════════════════════════════════════

const request = require('supertest');
const app     = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { createUser, createSkill, addUserSkill, createSwap, getToken, cleanupAll } = require('../helpers/factories');

const BASE = '/api/v1/swaps';
let userA, userB, tokenA, tokenB;
let skillA, skillB;

beforeAll(async () => {
  [userA, userB] = await Promise.all([
    createUser({ email: `swapA_${Date.now()}@test.skillswap.io` }),
    createUser({ email: `swapB_${Date.now()}@test.skillswap.io` }),
  ]);
  tokenA = getToken(userA);
  tokenB = getToken(userB);

  const { skill: sA } = await createSkill({ name: 'Guitar', slug: `guitar-${Date.now()}` });
  const { skill: sB } = await createSkill({ name: 'Python', slug: `python-${Date.now()}` });
  skillA = await addUserSkill(userA.id, sA.id, 'TEACH');
  skillB = await addUserSkill(userB.id, sB.id, 'TEACH');
});

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

// ── POST /swaps ───────────────────────────────────────────────
describe('POST /swaps', () => {
  it('creates a swap request and returns 201', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipientId:     userB.id,
        offeredSkillId:  skillA.id,
        requestedSkillId: skillB.id,
        introMessage:    'Hi! I would love to swap guitar for Python.',
        format:          'LIVE_VIDEO',
        frequency:       'WEEKLY',
        plannedSessions: 6,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.requesterId).toBe(userA.id);
  });

  it('returns 400 when trying to swap with yourself', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipientId:     userA.id,
        offeredSkillId:  skillA.id,
        requestedSkillId: skillA.id,
      });
    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).post(BASE).send({});
    expect(res.status).toBe(401);
  });
});

// ── GET /swaps ────────────────────────────────────────────────
describe('GET /swaps', () => {
  it('returns all swaps for the authenticated user', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('can filter by status', async () => {
    const res = await request(app)
      .get(`${BASE}?status=PENDING`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(s => expect(s.status).toBe('PENDING'));
  });

  it('returns 401 without token', async () => {
    expect((await request(app).get(BASE)).status).toBe(401);
  });
});

// ── PATCH /swaps/:id/accept ───────────────────────────────────
describe('PATCH /swaps/:swapId/accept', () => {
  let pendingSwap;

  beforeAll(async () => {
    const uC = await createUser({ email: `swapC_${Date.now()}@test.skillswap.io` });
    const uD = await createUser({ email: `swapD_${Date.now()}@test.skillswap.io` });
    pendingSwap = await createSwap(uC.id, uD.id, 'PENDING');
    // tokenD to accept
    pendingSwap._tokenD = getToken(uD);
    pendingSwap._tokenC = getToken(uC);
  });

  it('allows the recipient to accept the swap', async () => {
    const res = await request(app)
      .patch(`${BASE}/${pendingSwap.id}/accept`)
      .set('Authorization', `Bearer ${pendingSwap._tokenD}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('returns 403 if requester tries to accept their own swap', async () => {
    // Create a fresh pending swap
    const uE = await createUser({ email: `swapE_${Date.now()}@test.skillswap.io` });
    const uF = await createUser({ email: `swapF_${Date.now()}@test.skillswap.io` });
    const sw = await createSwap(uE.id, uF.id, 'PENDING');
    const res = await request(app)
      .patch(`${BASE}/${sw.id}/accept`)
      .set('Authorization', `Bearer ${getToken(uE)}`); // requester, not recipient
    expect([400, 403]).toContain(res.status);
  });
});

// ── PATCH /swaps/:id/decline ──────────────────────────────────
describe('PATCH /swaps/:swapId/decline', () => {
  it('allows the recipient to decline with a reason', async () => {
    const uG = await createUser({ email: `swapG_${Date.now()}@test.skillswap.io` });
    const uH = await createUser({ email: `swapH_${Date.now()}@test.skillswap.io` });
    const sw = await createSwap(uG.id, uH.id, 'PENDING');

    const res = await request(app)
      .patch(`${BASE}/${sw.id}/decline`)
      .set('Authorization', `Bearer ${getToken(uH)}`)
      .send({ reason: 'Scheduling does not work for me' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DECLINED');
  });
});

// ── PATCH /swaps/:id/cancel ───────────────────────────────────
describe('PATCH /swaps/:swapId/cancel', () => {
  it('allows either party to cancel an active swap', async () => {
    const uI = await createUser({ email: `swapI_${Date.now()}@test.skillswap.io` });
    const uJ = await createUser({ email: `swapJ_${Date.now()}@test.skillswap.io` });
    const sw = await createSwap(uI.id, uJ.id, 'ACTIVE');

    const res = await request(app)
      .patch(`${BASE}/${sw.id}/cancel`)
      .set('Authorization', `Bearer ${getToken(uI)}`)
      .send({ reason: 'Personal reasons' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('returns 404 if swap does not belong to the user', async () => {
    const uK = await createUser({ email: `swapK_${Date.now()}@test.skillswap.io` });
    const uL = await createUser({ email: `swapL_${Date.now()}@test.skillswap.io` });
    const uStranger = await createUser({ email: `stranger_${Date.now()}@test.skillswap.io` });
    const sw = await createSwap(uK.id, uL.id, 'ACTIVE');

    const res = await request(app)
      .patch(`${BASE}/${sw.id}/cancel`)
      .set('Authorization', `Bearer ${getToken(uStranger)}`);

    expect(res.status).toBe(404);
  });
});

// ── PATCH /swaps/:id/pause & resume ───────────────────────────
describe('PATCH /swaps/:swapId/pause & resume', () => {
  let activeSwap, tokenRequester;

  beforeAll(async () => {
    const uM = await createUser({ email: `swapM_${Date.now()}@test.skillswap.io` });
    const uN = await createUser({ email: `swapN_${Date.now()}@test.skillswap.io` });
    activeSwap    = await createSwap(uM.id, uN.id, 'ACTIVE');
    tokenRequester = getToken(uM);
  });

  it('pauses an active swap', async () => {
    const res = await request(app)
      .patch(`${BASE}/${activeSwap.id}/pause`)
      .set('Authorization', `Bearer ${tokenRequester}`)
      .send({ reason: 'On holiday' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAUSED');
  });

  it('resumes a paused swap', async () => {
    const res = await request(app)
      .patch(`${BASE}/${activeSwap.id}/resume`)
      .set('Authorization', `Bearer ${tokenRequester}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACTIVE');
  });
});
