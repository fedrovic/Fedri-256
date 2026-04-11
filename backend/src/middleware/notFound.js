'use strict';

module.exports = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code:    'NOT_FOUND',
    },
  });
};
