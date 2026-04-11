'use strict';

const router = require('express').Router();
const ctrl   = require('../controllers/search.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { prisma } = require('../config/database');

// Public — browse skill catalog
router.get('/',         ctrl.searchSkills);
router.get('/cats',     ctrl.getCategories);

// Admin — manage skill catalog
router.post('/', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, categoryId, description } = req.body;
    if (!name || !categoryId) {
      return res.status(400).json({ success: false, error: { message: 'name and categoryId required' } });
    }
    const slug = name.toLowerCase().replace(/[\s&/]+/g, '-').replace(/[^a-z0-9-]/g, '');
    const skill = await prisma.skill.create({
      data: { name: name.trim(), slug, categoryId, description },
      include: { category: true },
    });
    res.status(201).json({ success: true, data: skill });
  } catch (err) { next(err); }
});

router.patch('/:skillId', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, description, isApproved } = req.body;
    const skill = await prisma.skill.update({
      where: { id: req.params.skillId },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(isApproved !== undefined && { isApproved }) },
    });
    res.json({ success: true, data: skill });
  } catch (err) { next(err); }
});

module.exports = router;
