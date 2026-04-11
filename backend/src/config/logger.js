'use strict';

// Re-export from utils/logger so both require paths work:
//   require('../config/logger')   — used by controllers, middleware, sockets
//   require('../utils/logger')    — used by utils themselves
module.exports = require('../utils/logger');
