const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (error) {
    next(error);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { full_name, phone } = req.body;

    const result = await db.query(
      'UPDATE profiles SET full_name = $1, phone = $2 WHERE id = $3 RETURNING *',
      [full_name, phone, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
