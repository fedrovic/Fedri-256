'use strict';

const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number');

const register = z.object({
  body: z.object({
    email:          z.string().email('Invalid email address').toLowerCase().trim(),
    password:       passwordSchema,
    firstName:      z.string().min(1, 'First name required').max(50).trim(),
    lastName:       z.string().min(1, 'Last name required').max(50).trim(),
    marketingOptIn: z.boolean().optional().default(false),
  }),
});

const login = z.object({
  body: z.object({
    email:      z.string().email('Invalid email address').toLowerCase().trim(),
    password:   z.string().min(1, 'Password required'),
    rememberMe: z.boolean().optional().default(false),
  }),
});

const verifyEmail = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token required'),
  }),
});

const forgotPassword = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
  }),
});

const resetPassword = z.object({
  body: z.object({
    token:    z.string().min(1, 'Reset token required'),
    password: passwordSchema,
  }),
});

const verify2FA = z.object({
  body: z.object({
    tempToken: z.string().uuid('Invalid temp token'),
    code:      z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  }),
});

const confirm2FA = z.object({
  body: z.object({
    code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  }),
});

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword, verify2FA, confirm2FA };
