const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*, p.full_name, p.avatar_url, p.email
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.is_active = true
      ORDER BY t.rating DESC, t.total_sessions DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*, p.full_name, p.avatar_url, p.email
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
