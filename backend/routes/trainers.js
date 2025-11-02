const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        t.id,
        t.bio,
        t.experience_years,
        t.specialization,
        t.rating,
        t.total_sessions,
        t.is_active,
        p.id as user_id,
        p.full_name,
        p.avatar_url,
        p.email,
        p.phone
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.is_active = true
      ORDER BY t.rating DESC, t.total_sessions DESC
    `);

    // Format the response for frontend
    const formattedTrainers = result.rows.map(row => ({
      id: row.id,
      name: row.full_name,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar_url || null,
      bio: row.bio,
      experience_years: row.experience_years,
      specialization: row.specialization || [],
      rating: parseFloat(row.rating) || 0,
      total_sessions: row.total_sessions || 0,
      is_active: row.is_active
    }));

    res.json(formattedTrainers);
  } catch (error) {
    next(error);
  }
});

// Get active trainers (specific route before /:id to avoid conflict)
router.get('/active', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        t.id,
        t.bio,
        t.experience_years,
        t.specialization,
        t.rating,
        t.total_sessions,
        t.is_active,
        p.id as user_id,
        p.full_name,
        p.avatar_url,
        p.email,
        p.phone
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      WHERE t.is_active = true
      ORDER BY t.rating DESC, t.total_sessions DESC
    `);

    // Format the response for frontend
    const formattedTrainers = result.rows.map(row => ({
      id: row.id,
      name: row.full_name,
      email: row.email,
      phone: row.phone,
      avatar: row.avatar_url || null,
      bio: row.bio,
      experience_years: row.experience_years,
      specialization: row.specialization || [],
      rating: parseFloat(row.rating) || 0,
      total_sessions: row.total_sessions || 0,
      is_active: row.is_active
    }));

    res.json(formattedTrainers);
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
