'use strict';

module.exports = {
  PLAN_LIMITS: {
    FREE:    { maxActiveSwaps: 3,        canReceivePayments: false, hdVideo: false },
    PREMIUM: { maxActiveSwaps: Infinity, canReceivePayments: true,  hdVideo: true  },
    TEAMS:   { maxActiveSwaps: Infinity, canReceivePayments: true,  hdVideo: true  },
  },

  SKILLCOIN_EARN_PER_HOUR:    parseInt(process.env.SKILLCOIN_EARN_PER_HOUR)       || 1,
  SWAP_EXPIRY_DAYS:           parseInt(process.env.SWAP_AUTO_ARCHIVE_DAYS)         || 90,
  SWAP_WARNING_DAYS:          parseInt(process.env.SWAP_EXPIRY_WARNING_DAYS)       || 30,
  MAX_FILE_MB:                parseInt(process.env.MAX_FILE_UPLOAD_MB)             || 10,
  PLATFORM_COMMISSION:        parseInt(process.env.PLATFORM_COMMISSION_PERCENT)    || 12,
  MAX_RESCHEDULES_PER_MONTH:  2,
  SESSION_EARLY_JOIN_MINUTES: 10,
  OTP_TTL_MINUTES:            10,
  REFRESH_TOKEN_COOKIE_DAYS:  30,

  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],

  REVIEW_TAGS: [
    'Patient teacher', 'Well-prepared', 'Clear explanations',
    'Fast progress', 'Flexible scheduling', 'Great communicator',
    'Highly recommended', 'Deep knowledge', 'Real-world focus',
  ],
};
