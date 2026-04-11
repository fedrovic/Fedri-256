'use strict';
// ════════════════════════════════════════════════
//  tests/helpers/factories.js
//  Test data factories — create consistent test objects
// ════════════════════════════════════════════════

const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../src/config/database');

const TEST_PASSWORD      = 'TestPass123!';
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);

/**
 * Create a test user in the database
 */
const createUser = async (overrides = {}) => {
  const id = uuidv4();
  return prisma.user.create({
    data: {
      id,
      email:        overrides.email        || `user_${id.slice(0,8)}@test.skillswap.io`,
      displayName:  overrides.displayName  || 'Test User',
      firstName:    overrides.firstName    || 'Test',
      lastName:     overrides.lastName     || 'User',
      passwordHash: TEST_PASSWORD_HASH,
      emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : true,
      status:       overrides.status       || 'ACTIVE',
      role:         overrides.role         || 'USER',
      isPremium:    overrides.isPremium    || false,
      coinBalance:  overrides.coinBalance  !== undefined ? overrides.coinBalance : 5,
      timezone:     overrides.timezone     || 'UTC',
      ...overrides,
    },
  });
};

/**
 * Create an admin user
 */
const createAdmin = (overrides = {}) =>
  createUser({ role: 'ADMIN', ...overrides });

/**
 * Create a premium user
 */
const createPremiumUser = (overrides = {}) =>
  createUser({
    isPremium: true,
    premiumExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
  });

/**
 * Create a category + skill pair
 */
const createSkill = async (overrides = {}) => {
  const catSlug   = `cat-${uuidv4().slice(0, 8)}`;
  const skillSlug = `skill-${uuidv4().slice(0, 8)}`;

  const category = await prisma.category.upsert({
    where:  { slug: overrides.categorySlug || catSlug },
    update: {},
    create: {
      name:  overrides.categoryName || 'Test Category',
      slug:  overrides.categorySlug || catSlug,
      isActive: true,
    },
  });

  const skill = await prisma.skill.create({
    data: {
      name:       overrides.name       || 'Test Skill',
      slug:       overrides.slug       || skillSlug,
      categoryId: category.id,
      isApproved: true,
    },
  });

  return { category, skill };
};

/**
 * Add a skill to a user (teach or learn)
 */
const addUserSkill = async (userId, skillId, direction = 'TEACH', proficiency = 'INTERMEDIATE') =>
  prisma.userSkill.create({
    data: { userId, skillId, direction, proficiency, isActive: true },
  });

/**
 * Create a swap between two users
 */
const createSwap = async (requesterId, recipientId, statusOverride = 'ACTIVE', overrides = {}) => {
  const { skill: skill1 } = await createSkill({ name: 'Offered Skill', slug: `offered-${uuidv4().slice(0,8)}` });
  const { skill: skill2 } = await createSkill({ name: 'Requested Skill', slug: `requested-${uuidv4().slice(0,8)}` });

  const us1 = await addUserSkill(requesterId, skill1.id, 'TEACH');
  const us2 = await addUserSkill(recipientId, skill2.id, 'TEACH');

  return prisma.swap.create({
    data: {
      requesterId,
      recipientId,
      offeredSkillId:   us1.id,
      requestedSkillId: us2.id,
      status:           statusOverride,
      plannedSessions:  6,
      ...overrides,
    },
    include: {
      requester: { select: { id: true, displayName: true } },
      recipient: { select: { id: true, displayName: true } },
    },
  });
};

/**
 * Get a valid access token for a user
 */
const getToken = (user) => {
  const { signAccessToken } = require('../../src/utils/jwt');
  return signAccessToken({ sub: user.id, email: user.email, role: user.role });
};

/**
 * Cleanup a test user and all related data
 */
const cleanupUser = async (userId) => {
  if (!userId) return;
  await prisma.user.deleteMany({ where: { id: userId } });
};

/**
 * Wipe all test data (use carefully — only in test environment)
 */
const cleanupAll = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanupAll() must only run in test environment');
  }
  // Delete in dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.coinTransaction.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.sessionParticipant.deleteMany({});
  await prisma.sessionNote.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.badge.deleteMany({});
  await prisma.swap.deleteMany({});
  await prisma.userSkill.deleteMany({});
  await prisma.availability.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordReset.deleteMany({});
  await prisma.block.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.skillswap.io' } } });
};

module.exports = {
  TEST_PASSWORD,
  createUser,
  createAdmin,
  createPremiumUser,
  createSkill,
  addUserSkill,
  createSwap,
  getToken,
  cleanupUser,
  cleanupAll,
};
