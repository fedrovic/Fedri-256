'use strict';

const isProd = process.env.NODE_ENV === 'production';

const setCookies = (res, refreshToken, rememberMe = false) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge:   (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000,
    path:     '/api',
  });
};

const clearCookies = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path:     '/api',
  });
};

module.exports = { setCookies, clearCookies };
