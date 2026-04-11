'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/search.controller');
const { optionalAuth } = require('../middleware/auth');

router.get('/users',        optionalAuth, ctrl.searchUsers);
router.get('/skills',                     ctrl.searchSkills);
router.get('/categories',                 ctrl.getCategories);
router.get('/autocomplete',               ctrl.autocomplete);

module.exports = router;
