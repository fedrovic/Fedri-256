const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Generate a short-lived JWT access token
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpires,
    issuer: 'skillswap.io',
  });

/**
 * Generate a UUID-based opaque refresh token
 */
const generateRefreshToken = () => uuidv4();

/**
 * Verify and decode an access token. Returns null on failure.
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { issuer: 'skillswap.io' });
  } catch {
    return null;
  }
};

/**
 * Generate a numeric OTP of given length
 */
const generateOTP = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
};

/**
 * Calculate token expiry date from a duration string like "30d", "15m"
 */
const getExpiryDate = (duration) => {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  const ms = unit === 'd' ? value * 86400000
           : unit === 'h' ? value * 3600000
           : unit === 'm' ? value * 60000
           : value * 1000;
  return new Date(Date.now() + ms);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  generateOTP,
  getExpiryDate,
};
