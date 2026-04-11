'use strict';
// ════════════════════════════════════════════════════════════════
//  tests/integration/user.test.js
// ════════════════════════════════════════════════════════════════

const request = require('supertest');
const app  = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { createUser, createSkill, getToken, cleanupAll } = require('../helpers/factories');

afterAll(async () => {
  await cleanupAll();
  await prisma.$disconnect();
});

describe('GET /users/me', () => {
  it('returns authenticated user profile', async () => {
    const user  = await createUser({ email: `me_${Date.now()}@test.skillswap.io` });
    const token = getToken(user);
    const res   = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/v1/users/me')).status).toBe(401);
  });
});

describe('PATCH /users/me', () => {
  it('updates profile fields', async () => {
    const user  = await createUser({ email: `upd_${Date.now()}@test.skillswap.io` });
    const token = getToken(user);
    const res   = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'I love teaching.', location: 'Lagos, Nigeria', timezone: 'Africa/Lagos' });
    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('I love teaching.');
    expect(res.body.data.location).toBe('Lagos, Nigeria');
  });
});

describe('GET /users/:userId', () => {
  it('returns public profile', async () => {
    const user  = await createUser({ email: `pub_${Date.now()}@test.skillswap.io` });
    const other = await createUser({ email: `viewer_${Date.now()}@test.skillswap.io` });
    const token = getToken(other);
    const res   = await request(app).get(`/api/v1/users/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app).get('/api/v1/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('User skill management', () => {
  let user, token;

  beforeAll(async () => {
    user  = await createUser({ email: `skills_${Date.now()}@test.skillswap.io` });
    token = getToken(user);
  });

  it('adds a teach skill to profile', async () => {
    const { skill } = await createSkill({ name: 'Piano', slug: `piano-${Date.now()}` });
    const res = await request(app)
      .post('/api/v1/users/me/skills')
      .set('Authorization', `Bearer ${token}`)
      .send({ skillId: skill.id, direction: 'TEACH', proficiency: 'ADVANCED', description: 'Classical pianist' });
    expect(res.status).toBe(201);
    expect(res.body.data.direction).toBe('TEACH');
    expect(res.body.data.proficiency).toBe('ADVANCED');
  });

  it('returns 400 for duplicate skill direction', async () => {
    const { skill } = await createSkill({ name: 'Yoga', slug: `yoga-${Date.now()}` });
    await request(app).post('/api/v1/users/me/skills').set('Authorization', `Bearer ${token}`)
      .send({ skillId: skill.id, direction: 'TEACH', proficiency: 'EXPERT' });
    const res = await request(app).post('/api/v1/users/me/skills').set('Authorization', `Bearer ${token}`)
      .send({ skillId: skill.id, direction: 'TEACH', proficiency: 'EXPERT' });
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════
//  tests/integration/search.test.js
// ════════════════════════════════════════════════════════════════

describe('Search API', () => {
  describe('GET /search/categories', () => {
    it('returns category list', async () => {
      const res = await request(app).get('/api/v1/search/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /search/skills', () => {
    it('returns skills with pagination', async () => {
      const res = await request(app).get('/api/v1/search/skills?limit=5');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('filters skills by query string', async () => {
      const { skill } = await createSkill({ name: `UniqueSkill_${Date.now()}`, slug: `unique-${Date.now()}` });
      const res = await request(app).get(`/api/v1/search/skills?q=${skill.name}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /search/autocomplete', () => {
    it('returns autocomplete results for query', async () => {
      const res = await request(app).get('/api/v1/search/autocomplete?q=py');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns empty array for short query', async () => {
      const res = await request(app).get('/api/v1/search/autocomplete?q=x');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /search/users', () => {
    it('returns paginated user results', async () => {
      const res = await request(app).get('/api/v1/search/users?limit=5');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('excludes soft-deleted and banned users', async () => {
      const banned = await createUser({
        email: `banned_${Date.now()}@test.skillswap.io`,
        status: 'BANNED',
      });
      const res = await request(app).get('/api/v1/search/users');
      const found = res.body.data.find(u => u.id === banned.id);
      expect(found).toBeUndefined();
    });
  });
});

// ════════════════════════════════════════════════════════════════
//  tests/integration/coin.test.js
// ════════════════════════════════════════════════════════════════

describe('SkillCoin API', () => {
  let coinUser, coinToken;

  beforeAll(async () => {
    coinUser  = await createUser({ email: `coin_${Date.now()}@test.skillswap.io`, coinBalance: 10 });
    coinToken = getToken(coinUser);
  });

  describe('GET /coins/wallet', () => {
    it('returns balance and transaction history', async () => {
      const res = await request(app).get('/api/v1/coins/wallet').set('Authorization', `Bearer ${coinToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(10);
      expect(Array.isArray(res.body.data.recentTransactions)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      expect((await request(app).get('/api/v1/coins/wallet')).status).toBe(401);
    });
  });

  describe('POST /coins/spend', () => {
    it('spends coins and reduces balance', async () => {
      const res = await request(app)
        .post('/api/v1/coins/spend')
        .set('Authorization', `Bearer ${coinToken}`)
        .send({ amount: 2, description: 'Test spend' });
      expect(res.status).toBe(200);
      expect(res.body.data.newBalance).toBe(8);
    });

    it('returns 400 when insufficient balance', async () => {
      const brokeUser  = await createUser({ email: `broke_${Date.now()}@test.skillswap.io`, coinBalance: 0 });
      const brokeToken = getToken(brokeUser);
      const res = await request(app)
        .post('/api/v1/coins/spend')
        .set('Authorization', `Bearer ${brokeToken}`)
        .send({ amount: 5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for amount < 1', async () => {
      const res = await request(app)
        .post('/api/v1/coins/spend')
        .set('Authorization', `Bearer ${coinToken}`)
        .send({ amount: 0 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /coins/transfer', () => {
    it('transfers coins between users', async () => {
      const recipient  = await createUser({ email: `recv_${Date.now()}@test.skillswap.io`, coinBalance: 0 });
      const senderUser = await createUser({ email: `sender_${Date.now()}@test.skillswap.io`, coinBalance: 5 });
      const senderTok  = getToken(senderUser);

      const res = await request(app)
        .post('/api/v1/coins/transfer')
        .set('Authorization', `Bearer ${senderTok}`)
        .send({ recipientId: recipient.id, amount: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.newBalance).toBe(2);

      const recv = await prisma.user.findUnique({ where: { id: recipient.id } });
      expect(recv.coinBalance).toBe(3);
    });
  });
});

// ════════════════════════════════════════════════════════════════
//  tests/integration/review.test.js
// ════════════════════════════════════════════════════════════════

describe('Review API', () => {
  let reviewer, reviewee, completedSwap, reviewerToken;

  beforeAll(async () => {
    reviewer = await createUser({ email: `rev_a_${Date.now()}@test.skillswap.io` });
    reviewee = await createUser({ email: `rev_b_${Date.now()}@test.skillswap.io` });
    reviewerToken = getToken(reviewer);
    completedSwap = await createSwap(reviewer.id, reviewee.id, 'COMPLETED');
  });

  describe('POST /reviews', () => {
    it('creates a review for a completed swap', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ swapId: completedSwap.id, rating: 5, feedback: 'Excellent teacher!', tags: ['Patient teacher'] });
      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.reviewerId).toBe(reviewer.id);
    });

    it('returns 400 for duplicate review', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ swapId: completedSwap.id, rating: 4, feedback: 'Good.' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid rating', async () => {
      const newSwap = await createSwap(reviewer.id, reviewee.id, 'COMPLETED');
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ swapId: newSwap.id, rating: 6 }); // > 5
      expect(res.status).toBe(400);
    });
  });

  describe('GET /reviews/user/:userId', () => {
    it('returns reviews for a user', async () => {
      const res = await request(app).get(`/api/v1/reviews/user/${reviewee.id}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
