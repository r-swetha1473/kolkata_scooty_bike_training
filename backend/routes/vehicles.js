const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const auditService = require('../services/audit.service');
const router = express.Router();

// Get all vehicles (active only for public, all for admin)
router.get('/', async (req, res, next) => {
  try {
    const { include_inactive } = req.query;
    const includeAll = include_inactive === 'true';
    
    let query = 'SELECT id, name, max_per_slot, is_active, created_at, updated_at FROM vehicles';
    const params = [];
    
    if (!includeAll) {
      query += ' WHERE is_active = true';
    }
    
    query += ' ORDER BY name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, max_per_slot, is_active, created_at, updated_at FROM vehicles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      error.errorCode = 'VEHICLE_NOT_FOUND';
      return next(error);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create vehicle (admin only)
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { name, max_per_slot, is_active } = req.body;

    if (!name || !name.trim()) {
      const error = new Error('Vehicle name is required');
      error.status = 400;
      error.errorCode = 'MISSING_NAME';
      return next(error);
    }

    if (!max_per_slot || max_per_slot < 1) {
      const error = new Error('max_per_slot must be at least 1');
      error.status = 400;
      error.errorCode = 'INVALID_MAX_PER_SLOT';
      return next(error);
    }

    const result = await db.query(
      `INSERT INTO vehicles (name, max_per_slot, is_active)
       VALUES ($1, $2, $3)
       RETURNING id, name, max_per_slot, is_active, created_at, updated_at`,
      [name.trim(), max_per_slot, is_active !== undefined ? is_active : true]
    );

    const created = result.rows[0];
    
    // Log audit trail
    await auditService.logVehicleCreate(req.user.id, created);

    res.status(201).json(created);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      const uniqueError = new Error('A vehicle with this name already exists');
      uniqueError.status = 400;
      uniqueError.errorCode = 'DUPLICATE_NAME';
      return next(uniqueError);
    }
    next(error);
  }
});

// Update vehicle (admin only)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { name, max_per_slot, is_active } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name.trim()) {
        const error = new Error('Vehicle name cannot be empty');
        error.status = 400;
        error.errorCode = 'INVALID_NAME';
        return next(error);
      }
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }

    if (max_per_slot !== undefined) {
      if (max_per_slot < 1) {
        const error = new Error('max_per_slot must be at least 1');
        error.status = 400;
        error.errorCode = 'INVALID_MAX_PER_SLOT';
        return next(error);
      }
      updates.push(`max_per_slot = $${paramIndex++}`);
      params.push(max_per_slot);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      const error = new Error('No updates provided');
      error.status = 400;
      error.errorCode = 'NO_UPDATES';
      return next(error);
    }

    // Get current vehicle data for audit
    const beforeResult = await db.query(
      'SELECT id, name, max_per_slot, is_active FROM vehicles WHERE id = $1',
      [req.params.id]
    );
    if (beforeResult.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      error.errorCode = 'VEHICLE_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await db.query(
      `UPDATE vehicles 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, max_per_slot, is_active, created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      error.errorCode = 'VEHICLE_NOT_FOUND';
      return next(error);
    }

    const updated = result.rows[0];
    
    // Log audit trail
    await auditService.logVehicleUpdate(req.user.id, req.params.id, beforeData, updated);

    res.json(updated);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      const uniqueError = new Error('A vehicle with this name already exists');
      uniqueError.status = 400;
      uniqueError.errorCode = 'DUPLICATE_NAME';
      return next(uniqueError);
    }
    next(error);
  }
});

// Delete vehicle (admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const error = new Error('Forbidden');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    // Get vehicle data before deletion for audit
    const vehicleResult = await db.query(
      'SELECT id, name, max_per_slot, is_active FROM vehicles WHERE id = $1',
      [req.params.id]
    );
    if (vehicleResult.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      error.errorCode = 'VEHICLE_NOT_FOUND';
      return next(error);
    }
    const vehicleData = vehicleResult.rows[0];

    // Check if vehicle has active bookings
    const bookingCheck = await db.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE vehicle_id = $1 AND status NOT IN ('cancelled')`,
      [req.params.id]
    );

    if (parseInt(bookingCheck.rows[0].count) > 0) {
      const error = new Error('Cannot delete vehicle with active bookings. Deactivate it instead.');
      error.status = 400;
      error.errorCode = 'VEHICLE_HAS_BOOKINGS';
      return next(error);
    }

    const result = await db.query(
      'DELETE FROM vehicles WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Vehicle not found');
      error.status = 404;
      error.errorCode = 'VEHICLE_NOT_FOUND';
      return next(error);
    }

    // Log audit trail
    await auditService.logVehicleDelete(req.user.id, vehicleData);

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

