'use strict';
const { z } = require('zod');

// ── Swap validators ───────────────────────────────────────────
const createSwap = z.object({
  body: z.object({
    recipientId:      z.string().uuid('Invalid recipient ID'),
    offeredSkillId:   z.string().uuid('Invalid offered skill ID'),
    requestedSkillId: z.string().uuid('Invalid requested skill ID'),
    format:           z.enum(['LIVE_VIDEO', 'ASYNC', 'IN_PERSON']).optional().default('LIVE_VIDEO'),
    frequency:        z.enum(['WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'FLEXIBLE']).optional().default('WEEKLY'),
    plannedSessions:  z.number().int().min(1).max(52).optional().default(6),
    introMessage:     z.string().max(500).optional(),
  }),
});

const declineSwap = z.object({
  body: z.object({
    reason: z.string().max(300).optional(),
  }),
});

const counterPropose = z.object({
  body: z.object({
    offeredSkillId:   z.string().uuid().optional(),
    requestedSkillId: z.string().uuid().optional(),
    format:           z.enum(['LIVE_VIDEO', 'ASYNC', 'IN_PERSON']).optional(),
    frequency:        z.enum(['WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'FLEXIBLE']).optional(),
    plannedSessions:  z.number().int().min(1).max(52).optional(),
    message:          z.string().max(500).optional(),
  }),
});

const pauseSwap = z.object({
  body: z.object({
    reason: z.string().max(300).optional(),
  }),
});

const openDispute = z.object({
  body: z.object({
    issueType: z.enum([
      'PARTNER_TAUGHT_WRONG_INFO',
      'PARTNER_STOPPED_RESPONDING',
      'PARTNER_MISSED_SESSIONS',
      'MISREPRESENTED_CREDENTIALS',
      'UNPROFESSIONAL_CONDUCT',
      'OTHER',
    ]),
    description: z.string().min(20, 'Please provide at least 20 characters describing the issue').max(2000),
  }),
});

// ── Session validators ────────────────────────────────────────
const scheduleSession = z.object({
  body: z.object({
    scheduledAt:     z.string().datetime('Must be a valid ISO datetime'),
    durationMinutes: z.number().int().min(30).max(180).optional().default(60),
    format:          z.enum(['LIVE_VIDEO', 'ASYNC', 'IN_PERSON']).optional().default('LIVE_VIDEO'),
    agenda:          z.string().max(1000).optional(),
  }),
  params: z.object({
    swapId: z.string().uuid('Invalid swap ID'),
  }),
});

const rescheduleSession = z.object({
  body: z.object({
    scheduledAt: z.string().datetime('Must be a valid ISO datetime'),
    reason:      z.string().max(300).optional(),
  }),
});

// ── Message validators ────────────────────────────────────────
const sendMessage = z.object({
  body: z.object({
    content: z.string().max(2000).optional(),
    type:    z.enum(['TEXT', 'IMAGE', 'FILE', 'SESSION_INVITE']).optional().default('TEXT'),
  }),
  params: z.object({
    swapId: z.string().uuid('Invalid swap ID'),
  }),
});

const addReaction = z.object({
  body: z.object({
    emoji: z.enum(['👍', '❤️', '😊', '🎉', '🙏', '🔥', '👏', '😂'], {
      errorMap: () => ({ message: 'Invalid emoji. Allowed: 👍 ❤️ 😊 🎉 🙏 🔥 👏 😂' }),
    }),
  }),
});

// ── Review validators ─────────────────────────────────────────
const createReview = z.object({
  body: z.object({
    swapId:   z.string().uuid('Invalid swap ID'),
    rating:   z.number().int().min(1, 'Minimum rating is 1').max(5, 'Maximum rating is 5'),
    feedback: z.string().max(300).optional(),
    tags:     z.array(z.string()).max(5).optional().default([]),
  }),
});

const respondToReview = z.object({
  body: z.object({
    response: z.string().min(1).max(200, 'Response must be 200 characters or less'),
  }),
});

// ── User validators ───────────────────────────────────────────
const updateProfile = z.object({
  body: z.object({
    displayName:       z.string().min(2).max(60).optional(),
    firstName:         z.string().max(50).optional(),
    lastName:          z.string().max(50).optional(),
    bio:               z.string().max(500).optional(),
    location:          z.string().max(100).optional(),
    timezone:          z.string().max(50).optional(),
    languages:         z.array(z.string()).max(10).optional(),
    profileVisibility: z.enum(['PUBLIC', 'REGISTERED', 'HIDDEN']).optional(),
  }),
});

const addSkill = z.object({
  body: z.object({
    skillId:      z.string().uuid('Invalid skill ID'),
    direction:    z.enum(['TEACH', 'LEARN']),
    proficiency:  z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
    description:  z.string().max(200).optional(),
    portfolioUrl: z.string().url().optional().or(z.literal('')),
  }),
});

const setAvailability = z.object({
  body: z.object({
    availability: z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
      endTime:   z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
      timezone:  z.string().optional(),
    })).max(7),
  }),
});

// ── Coin validators ───────────────────────────────────────────
const spendCoins = z.object({
  body: z.object({
    amount:      z.number().int().min(1, 'Amount must be at least 1'),
    swapId:      z.string().uuid().optional(),
    description: z.string().max(200).optional(),
  }),
});

const transferCoins = z.object({
  body: z.object({
    recipientId: z.string().uuid('Invalid recipient ID'),
    amount:      z.number().int().min(1),
    swapId:      z.string().uuid().optional(),
  }),
});

module.exports = {
  // Swap
  createSwap, declineSwap, counterPropose, pauseSwap, openDispute,
  // Session
  scheduleSession, rescheduleSession,
  // Message
  sendMessage, addReaction,
  // Review
  createReview, respondToReview,
  // User
  updateProfile, addSkill, setAvailability,
  // Coins
  spendCoins, transferCoins,
};
