'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/** Generate a random hex OTP */
const generateOTP = (length = 8) =>
  crypto.randomBytes(length).toString('hex').toUpperCase().slice(0, length);

/** Hash an OTP for safe DB storage */
const hashOTP = (otp) => bcrypt.hash(otp, 10);

/** Verify a plain OTP against a stored hash */
const verifyOTP = (otp, hash) => bcrypt.compare(otp, hash);

module.exports = { generateOTP, hashOTP, verifyOTP };
