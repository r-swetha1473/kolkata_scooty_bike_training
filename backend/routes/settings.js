const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Get all settings (public)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM settings ORDER BY key');
    
    // Convert to object format
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Get all settings with metadata (admin only)
router.get('/all', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query('SELECT * FROM settings ORDER BY key');
    
    // Convert to array format with metadata
    const settings = result.rows.map(row => ({
      key: row.key,
      value: row.value,
      description: row.description,
      updated_at: row.updated_at,
      updated_by: row.updated_by
    }));

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Get single setting (public)
router.get('/:key', async (req, res, next) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', [req.params.key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: req.params.key, value: result.rows[0].value });
  } catch (error) {
    next(error);
  }
});

// Update setting (admin only)
router.put('/:key', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { value, description } = req.body;

    const result = await db.query(`
      INSERT INTO settings (key, value, description, updated_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (key) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        description = COALESCE(EXCLUDED.description, settings.description),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `, [req.params.key, JSON.stringify(value), description || '', req.user.id]);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update multiple settings (admin only)
router.put('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const settings = req.body;

    for (const [key, data] of Object.entries(settings)) {
      const { value, description } = typeof data === 'object' && data !== null && !Array.isArray(data) ? data : { value: data };
      
      await db.query(`
        INSERT INTO settings (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          description = COALESCE(EXCLUDED.description, settings.description),
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [key, JSON.stringify(value), description || '', req.user.id]);
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

