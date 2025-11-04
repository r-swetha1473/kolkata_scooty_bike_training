const express = require('express');
const db = require('../db');
const router = express.Router();

// Get all active vehicles
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM vehicles 
      WHERE is_active = true 
      ORDER BY type, name
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM vehicles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

