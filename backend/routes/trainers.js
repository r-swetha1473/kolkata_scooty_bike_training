const express = require('express');
const db = require('../db');
const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPublicTrainer(row) {
  return {
    id: row.id.toString(),
    user_id: row.user_id.toString(),
    bio: row.bio || '',
    experience_years: row.experience_years || 0,
    specialization: row.specialization || [],
    rating: parseFloat(row.rating) || 0,
    total_sessions: row.total_sessions || 0,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    profile: {
      full_name: row.full_name,
      avatar_url: row.avatar_url || null
    }
  };
}

const PUBLIC_TRAINER_SELECT = `
  SELECT
    t.id,
    t.user_id,
    t.bio,
    t.experience_years,
    t.specialization,
    t.rating,
    t.total_sessions,
    t.is_active,
    t.created_at,
    t.updated_at,
    p.full_name,
    p.avatar_url
  FROM trainers t
  JOIN profiles p ON t.user_id = p.id
`;

router.get('/available-for-slot/:slotId', async (req, res, next) => {
  try {
    const slotId = String(req.params.slotId || '').trim();
    if (!UUID_RE.test(slotId)) {
      const err = new Error('Invalid slot id');
      err.status = 400;
      err.errorCode = 'INVALID_SLOT_ID';
      return next(err);
    }

    const slotExists = await db.query('SELECT 1 FROM slots WHERE id = $1', [slotId]);
    if (slotExists.rows.length === 0) {
      const err = new Error('Slot not found');
      err.status = 404;
      err.errorCode = 'SLOT_NOT_FOUND';
      return next(err);
    }

    const result = await db.query(
      `${PUBLIC_TRAINER_SELECT}
       WHERE t.is_active = true
       ORDER BY t.rating DESC NULLS LAST, t.total_sessions DESC NULLS LAST, p.full_name ASC`,
      []
    );

    res.json(result.rows.map(formatPublicTrainer));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `${PUBLIC_TRAINER_SELECT}
       WHERE t.is_active = true
       ORDER BY t.rating DESC, t.total_sessions DESC`
    );
    res.json(result.rows.map(formatPublicTrainer));
  } catch (error) {
    next(error);
  }
});

router.get('/active', async (req, res, next) => {
  try {
    const result = await db.query(
      `${PUBLIC_TRAINER_SELECT}
       WHERE t.is_active = true
       ORDER BY t.rating DESC, t.total_sessions DESC`
    );
    res.json(result.rows.map(formatPublicTrainer));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `${PUBLIC_TRAINER_SELECT} WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Trainer not found');
      error.status = 404;
      error.errorCode = 'TRAINER_NOT_FOUND';
      return next(error);
    }

    res.json(formatPublicTrainer(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
