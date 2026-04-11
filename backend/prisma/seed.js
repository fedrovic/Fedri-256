'use strict';
// ════════════════════════════════════════════════════
//  DATABASE SEED  —  prisma/seed.js
//  Run: node prisma/seed.js
// ════════════════════════════════════════════════════

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SkillSwap database...');

  // ── 1. Categories ─────────────────────────────────
  const categories = await Promise.all([
    upsertCategory('Technology',    'technology',    '💻', 1),
    upsertCategory('Languages',     'languages',     '🌍', 2),
    upsertCategory('Design & Art',  'design',        '🎨', 3),
    upsertCategory('Music',         'music',         '🎵', 4),
    upsertCategory('Business',      'business',      '📈', 5),
    upsertCategory('Fitness',       'fitness',       '🏋️', 6),
    upsertCategory('Cooking',       'cooking',       '🍳', 7),
    upsertCategory('Photography',   'photography',   '📸', 8),
    upsertCategory('Writing',       'writing',       '✍️', 9),
    upsertCategory('Mathematics',   'mathematics',   '🧮', 10),
    upsertCategory('Video & Film',  'video',         '🎬', 11),
    upsertCategory('Science',       'science',       '🔬', 12),
  ]);

  const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));

  // ── 2. Skills ──────────────────────────────────────
  const skills = [
    // Tech
    ['Python Programming',    'python',           catMap.technology],
    ['JavaScript / React',    'javascript-react', catMap.technology],
    ['TypeScript',            'typescript',       catMap.technology],
    ['SQL & PostgreSQL',      'sql-postgresql',   catMap.technology],
    ['UI/UX Design',          'ui-ux-design',     catMap.technology],
    ['Data Science',          'data-science',     catMap.technology],
    ['Machine Learning',      'machine-learning', catMap.technology],
    ['iOS Development',       'ios-development',  catMap.technology],
    ['Android Development',   'android-dev',      catMap.technology],
    ['DevOps & Docker',       'devops-docker',    catMap.technology],
    ['Cybersecurity',         'cybersecurity',    catMap.technology],
    ['Excel & Spreadsheets',  'excel',            catMap.technology],

    // Languages
    ['Spanish',   'spanish',   catMap.languages],
    ['French',    'french',    catMap.languages],
    ['Mandarin',  'mandarin',  catMap.languages],
    ['German',    'german',    catMap.languages],
    ['Arabic',    'arabic',    catMap.languages],
    ['Japanese',  'japanese',  catMap.languages],
    ['Portuguese','portuguese',catMap.languages],
    ['Italian',   'italian',   catMap.languages],
    ['Hindi',     'hindi',     catMap.languages],
    ['Swahili',   'swahili',   catMap.languages],

    // Design
    ['Graphic Design',      'graphic-design',      catMap.design],
    ['Illustration',        'illustration',        catMap.design],
    ['Video Editing',       'video-editing',       catMap.design],
    ['3D Modelling',        '3d-modelling',        catMap.design],
    ['Figma',               'figma',               catMap.design],

    // Music
    ['Guitar',         'guitar',          catMap.music],
    ['Piano',          'piano',           catMap.music],
    ['Music Theory',   'music-theory',    catMap.music],
    ['Singing',        'singing',         catMap.music],
    ['Music Production','music-production',catMap.music],
    ['Drums',          'drums',           catMap.music],

    // Business
    ['Digital Marketing',  'digital-marketing',  catMap.business],
    ['SEO',                'seo',                catMap.business],
    ['Public Speaking',    'public-speaking',    catMap.business],
    ['Financial Planning', 'financial-planning', catMap.business],
    ['Project Management', 'project-management', catMap.business],

    // Fitness
    ['Yoga',              'yoga',              catMap.fitness],
    ['Personal Training', 'personal-training', catMap.fitness],
    ['Meditation',        'meditation',        catMap.fitness],
    ['Martial Arts',      'martial-arts',      catMap.fitness],

    // Cooking
    ['Italian Cuisine',   'italian-cuisine',   catMap.cooking],
    ['Baking & Pastry',   'baking-pastry',     catMap.cooking],
    ['Vegan Cooking',     'vegan-cooking',     catMap.cooking],
    ['Sushi Making',      'sushi-making',      catMap.cooking],

    // Photography
    ['Portrait Photography',  'portrait-photography',  catMap.photography],
    ['Landscape Photography', 'landscape-photography', catMap.photography],
    ['Photo Editing',         'photo-editing',         catMap.photography],

    // Writing
    ['Creative Writing',  'creative-writing',  catMap.writing],
    ['Copywriting',       'copywriting',       catMap.writing],
    ['Technical Writing', 'technical-writing', catMap.writing],

    // Math
    ['Calculus',    'calculus',    catMap.mathematics],
    ['Statistics',  'statistics',  catMap.mathematics],
    ['Chess',       'chess',       catMap.mathematics],
  ];

  for (const [name, slug, categoryId] of skills) {
    await prisma.skill.upsert({
      where: { slug },
      update: {},
      create: { name, slug, categoryId, isApproved: true },
    });
  }

  console.log(`✅ Seeded ${skills.length} skills across ${categories.length} categories`);

  // ── 3. Test users ─────────────────────────────────
  const passwordHash = await bcrypt.hash('Test1234!', 12);

  const testUsers = [
    {
      email: 'john.doe@test.skillswap.io',
      displayName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Full-stack developer and guitar enthusiast. Happy to teach Python, JS and guitar.',
      location: 'Kampala, Uganda',
      timezone: 'Africa/Kampala',
      coinBalance: 14,
    },
    {
      email: 'maria.kovac@test.skillswap.io',
      displayName: 'Maria Kovač',
      firstName: 'Maria',
      lastName: 'Kovač',
      bio: 'Senior Software Engineer in Zagreb. Teaching Python and Spanish.',
      location: 'Zagreb, Croatia',
      timezone: 'Europe/Zagreb',
      reputationScore: 4.9,
      totalSessions: 24,
      coinBalance: 22,
    },
    {
      email: 'sara.lindqvist@test.skillswap.io',
      displayName: 'Sara Lindqvist',
      firstName: 'Sara',
      lastName: 'Lindqvist',
      bio: 'Certified yoga instructor and amateur photographer.',
      location: 'Stockholm, Sweden',
      timezone: 'Europe/Stockholm',
      reputationScore: 4.7,
      totalSessions: 18,
      coinBalance: 8,
    },
  ];

  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
        languages: ['English'],
      },
    });
    console.log(`👤 Seeded user: ${user.displayName} (${user.email})`);
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nTest accounts:');
  testUsers.forEach(u => console.log(`  📧 ${u.email}  🔑 Test1234!`));
}

async function upsertCategory(name, slug, icon, displayOrder) {
  return prisma.category.upsert({
    where: { slug },
    update: { displayOrder },
    create: { name, slug, icon, displayOrder, isActive: true },
  });
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
