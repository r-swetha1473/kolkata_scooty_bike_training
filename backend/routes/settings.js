const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { validateSettingUpdate, validateSettingsUpdate } = require('../validators');
const { filterPublicSettings, isPublicSettingsKey, PUBLIC_SETTINGS_KEYS } = require('../utils/publicSettings');
const router = express.Router();

// Get public site settings only (no operational/admin keys)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT key, value FROM settings WHERE key = ANY($1::text[]) ORDER BY key`,
      [PUBLIC_SETTINGS_KEYS]
    );

    res.json(filterPublicSettings(result.rows));
  } catch (error) {
    next(error);
  }
});

// Get all settings with metadata (admin only)
router.get('/all', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
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

// Get single public site setting
router.get('/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!isPublicSettingsKey(key)) {
      const error = new Error('Setting not found');
      error.status = 404;
      error.errorCode = 'SETTING_NOT_FOUND';
      return next(error);
    }

    const result = await db.query('SELECT value FROM settings WHERE key = $1', [key]);

    if (result.rows.length === 0) {
      const error = new Error('Setting not found');
      error.status = 404;
      error.errorCode = 'SETTING_NOT_FOUND';
      return next(error);
    }

    res.json({ key, value: result.rows[0].value });
  } catch (error) {
    next(error);
  }
});

// Update setting (admin only)
router.put('/:key', authenticate, validateSettingUpdate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
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
router.put('/', authenticate, validateSettingsUpdate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
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

