const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { trainer_id, start_date, end_date } = req.query;

    let query = `
      SELECT s.*,
             t.user_id as trainer_user_id,
             p.full_name as trainer_name
      FROM slots s
      JOIN trainers t ON s.trainer_id = t.id
      JOIN profiles p ON t.user_id = p.id
      WHERE s.status = 'available'
    `;

    const params = [];

    if (trainer_id) {
      params.push(trainer_id);
      query += ` AND s.trainer_id = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND s.start_time >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND s.start_time <= $${params.length}`;
    }

    query += ' ORDER BY s.start_time ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
