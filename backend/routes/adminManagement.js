const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, authorize, authorizeAdmin } = require('../middleware/auth');
const { validateAdminCreation, validateAdminUpdate, validatePasswordReset, validatePasswordChange } = require('../validators/adminManagement.validator');
const auditService = require('../services/audit.service');
const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/admin-management/create
 * Create a new admin (SUPER_ADMIN only)
 */
router.post('/create', authorizeAdmin('SUPER_ADMIN'), validateAdminCreation, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { email, full_name, password, role, phone } = req.body;

    // Check if email already exists in profiles
    const existingProfile = await client.query(
      'SELECT id FROM profiles WHERE email = $1',
      [email]
    );

    if (existingProfile.rows.length > 0) {
      // Check if admin already exists for this profile
      const existingAdmin = await client.query(
        'SELECT id FROM admins WHERE profile_id = $1',
        [existingProfile.rows[0].id]
      );

      if (existingAdmin.rows.length > 0) {
        await client.query('ROLLBACK');
        const error = new Error('Admin account already exists for this email');
        error.status = 409;
        error.errorCode = 'ADMIN_ALREADY_EXISTS';
        return next(error);
      }

      // Profile exists but no admin account - create admin linked to existing profile
      const profileId = existingProfile.rows[0].id;
      
      // Get current admin's admin ID (from admins table) for created_by
      const currentAdminResult = await client.query(
        `SELECT id FROM admins WHERE profile_id = $1`,
        [req.user.id]
      );
      const createdByAdminId = currentAdminResult.rows.length > 0 ? currentAdminResult.rows[0].id : null;
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin account
      const adminResult = await client.query(
        `INSERT INTO admins (profile_id, role, password_hash, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, profile_id, role, is_active, created_at`,
        [profileId, role, passwordHash, true, createdByAdminId]
      );

      await client.query('COMMIT');

      // Get full admin details with profile
      const adminDetails = await db.query(
        `SELECT 
          a.id,
          a.role,
          a.is_active,
          a.created_at,
          a.updated_at,
          p.id as profile_id,
          p.email,
          p.full_name,
          p.phone
         FROM admins a
         JOIN profiles p ON a.profile_id = p.id
         WHERE a.id = $1`,
        [adminResult.rows[0].id]
      );

      // Log audit trail (use profile ID for admin_id in audit log)
      await auditService.logAdminAction({
        adminId: req.user.id,
        actionType: 'CREATE_ADMIN',
        entityType: 'admin',
        entityId: adminResult.rows[0].id,
        afterValue: adminDetails.rows[0],
        details: { created_by: req.user.id, created_by_admin_id: createdByAdminId, role }
      });

      res.status(201).json({
        message: 'Admin created successfully',
        admin: adminDetails.rows[0]
      });
    } else {
      // Profile doesn't exist - create both profile and admin
      const defaultPhone = phone || `ADMIN_${Date.now()}`;

      // Create profile first
      const profileResult = await client.query(
        `INSERT INTO profiles (email, full_name, phone, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [email, full_name, defaultPhone, 'admin']
      );

      const profileId = profileResult.rows[0].id;

      // Get current admin's admin ID (from admins table) for created_by
      const currentAdminResult = await client.query(
        `SELECT id FROM admins WHERE profile_id = $1`,
        [req.user.id]
      );
      const createdByAdminId = currentAdminResult.rows.length > 0 ? currentAdminResult.rows[0].id : null;

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin account
      const adminResult = await client.query(
        `INSERT INTO admins (profile_id, role, password_hash, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, profile_id, role, is_active, created_at`,
        [profileId, role, passwordHash, true, createdByAdminId]
      );

      await client.query('COMMIT');

      // Get full admin details with profile
      const adminDetails = await db.query(
        `SELECT 
          a.id,
          a.role,
          a.is_active,
          a.created_at,
          a.updated_at,
          p.id as profile_id,
          p.email,
          p.full_name,
          p.phone
         FROM admins a
         JOIN profiles p ON a.profile_id = p.id
         WHERE a.id = $1`,
        [adminResult.rows[0].id]
      );

      // Log audit trail (use profile ID for admin_id in audit log)
      await auditService.logAdminAction({
        adminId: req.user.id,
        actionType: 'CREATE_ADMIN',
        entityType: 'admin',
        entityId: adminResult.rows[0].id,
        afterValue: adminDetails.rows[0],
        details: { created_by: req.user.id, created_by_admin_id: createdByAdminId, role }
      });

      res.status(201).json({
        message: 'Admin created successfully',
        admin: adminDetails.rows[0]
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error.code === '23505') {
      const error = new Error('Email or admin account already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_ADMIN';
      return next(error);
    }
    
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin-management/list
 * List all admins (SUPER_ADMIN only)
 */
router.get('/list', authorizeAdmin('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { role, is_active, search } = req.query;

    let query = `
      SELECT 
        a.id,
        a.role,
        a.is_active,
        a.last_login_at,
        a.failed_login_attempts,
        a.locked_until,
        a.created_at,
        a.updated_at,
        p.id as profile_id,
        p.email,
        p.full_name,
        p.phone,
        creator.email as created_by_email,
        creator.full_name as created_by_name
      FROM admins a
      JOIN profiles p ON a.profile_id = p.id
      LEFT JOIN admins creator_admin ON a.created_by = creator_admin.id
      LEFT JOIN profiles creator ON creator_admin.profile_id = creator.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (role) {
      params.push(role);
      query += ` AND a.role = $${paramIndex++}`;
    }

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND a.is_active = $${paramIndex++}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        p.email ILIKE $${paramIndex} OR 
        p.full_name ILIKE $${paramIndex} OR 
        p.phone ILIKE $${paramIndex}
      )`;
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await db.query(query, params);

    // Remove password_hash from response (not selected, but ensure)
    const admins = result.rows.map(admin => {
      const { password_hash, ...adminWithoutPassword } = admin;
      return adminWithoutPassword;
    });

    res.json({
      count: admins.length,
      admins
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin-management/:id
 * Get admin details by ID (SUPER_ADMIN can view any, ADMIN can view own)
 */
router.get('/:id', authorizeAdmin('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // SUPER_ADMIN can view any admin, ADMIN can only view themselves
    if (req.user.adminRole !== 'SUPER_ADMIN') {
      // Check if requesting own admin account
      const ownAdmin = await db.query(
        `SELECT a.id FROM admins a 
         JOIN profiles p ON a.profile_id = p.id 
         WHERE p.id = $1`,
        [req.user.id]
      );

      if (ownAdmin.rows.length === 0 || ownAdmin.rows[0].id !== id) {
        const error = new Error('Insufficient permissions');
        error.status = 403;
        error.errorCode = 'INSUFFICIENT_PERMISSIONS';
        return next(error);
      }
    }

    const result = await db.query(
      `SELECT 
        a.id,
        a.role,
        a.is_active,
        a.last_login_at,
        a.failed_login_attempts,
        a.locked_until,
        a.created_at,
        a.updated_at,
        p.id as profile_id,
        p.email,
        p.full_name,
        p.phone,
        creator.email as created_by_email,
        creator.full_name as created_by_name
       FROM admins a
       JOIN profiles p ON a.profile_id = p.id
       LEFT JOIN admins creator_admin ON a.created_by = creator_admin.id
       LEFT JOIN profiles creator ON creator_admin.profile_id = creator.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    const { password_hash, ...admin } = result.rows[0];
    res.json(admin);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin-management/update/:id
 * Update admin details (SUPER_ADMIN only)
 */
router.put('/update/:id', authorizeAdmin('SUPER_ADMIN'), validateAdminUpdate, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { full_name, email, phone, is_active, role } = req.body;

    // Get current admin data for audit
    const beforeResult = await client.query(
      `SELECT 
        a.*,
        p.email,
        p.full_name,
        p.phone
       FROM admins a
       JOIN profiles p ON a.profile_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    if (beforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    const beforeData = beforeResult.rows[0];
    const profileId = beforeData.profile_id;

    // Prevent self-deactivation or role change
    const ownAdminResult = await client.query(
      `SELECT a.id FROM admins a 
       JOIN profiles p ON a.profile_id = p.id 
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (ownAdminResult.rows.length > 0 && ownAdminResult.rows[0].id === id) {
      if (is_active === false) {
        await client.query('ROLLBACK');
        const error = new Error('Cannot deactivate your own account');
        error.status = 400;
        error.errorCode = 'CANNOT_DEACTIVATE_SELF';
        return next(error);
      }
      if (role && role !== beforeData.role) {
        await client.query('ROLLBACK');
        const error = new Error('Cannot change your own role');
        error.status = 400;
        error.errorCode = 'CANNOT_CHANGE_OWN_ROLE';
        return next(error);
      }
    }

    // Update admin table
    const adminUpdates = [];
    const adminParams = [];
    let adminParamIndex = 1;

    if (is_active !== undefined) {
      adminUpdates.push(`is_active = $${adminParamIndex++}`);
      adminParams.push(is_active);
    }

    if (role) {
      adminUpdates.push(`role = $${adminParamIndex++}`);
      adminParams.push(role);
    }

    if (adminUpdates.length > 0) {
      adminUpdates.push(`updated_at = NOW()`);
      adminParams.push(id);
      await client.query(
        `UPDATE admins SET ${adminUpdates.join(', ')} WHERE id = $${adminParamIndex}`,
        adminParams
      );
    }

    // Update profile table
    const profileUpdates = [];
    const profileParams = [];
    let profileParamIndex = 1;

    if (full_name !== undefined) {
      profileUpdates.push(`full_name = $${profileParamIndex++}`);
      profileParams.push(full_name);
    }

    if (email !== undefined) {
      profileUpdates.push(`email = $${profileParamIndex++}`);
      profileParams.push(email);
    }

    if (phone !== undefined) {
      profileUpdates.push(`phone = $${profileParamIndex++}`);
      profileParams.push(phone);
    }

    if (profileUpdates.length > 0) {
      profileUpdates.push(`updated_at = NOW()`);
      profileParams.push(profileId);
      await client.query(
        `UPDATE profiles SET ${profileUpdates.join(', ')} WHERE id = $${profileParamIndex}`,
        profileParams
      );
    }

    await client.query('COMMIT');

    // Get updated admin data
    const afterResult = await db.query(
      `SELECT 
        a.*,
        p.email,
        p.full_name,
        p.phone
       FROM admins a
       JOIN profiles p ON a.profile_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    const afterData = afterResult.rows[0];

    // Log audit trail
    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_ADMIN',
      entityType: 'admin',
      entityId: id,
      beforeValue: beforeData,
      afterValue: afterData,
      details: { updated_fields: Object.keys(req.body) }
    });

    const { password_hash, ...admin } = afterData;
    res.json({
      message: 'Admin updated successfully',
      admin
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error.code === '23505') {
      const error = new Error('Email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      return next(error);
    }
    
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin-management/change-password
 * Change own password (any logged-in admin)
 */
router.put('/change-password', authorizeAdmin('ADMIN', 'SUPER_ADMIN'), validatePasswordChange, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { old_password, new_password } = req.body;

    // Get admin account from admins table
    const adminResult = await client.query(
      `SELECT a.id, a.password_hash, a.is_active, a.locked_until
       FROM admins a
       JOIN profiles p ON a.profile_id = p.id
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (adminResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Admin account not found');
      error.status = 404;
      error.errorCode = 'ADMIN_ACCOUNT_NOT_FOUND';
      return next(error);
    }

    const admin = adminResult.rows[0];

    // Check if account is active
    if (!admin.is_active) {
      await client.query('ROLLBACK');
      const error = new Error('Admin account is inactive');
      error.status = 403;
      error.errorCode = 'ADMIN_ACCOUNT_INACTIVE';
      return next(error);
    }

    // Check if account is locked
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      await client.query('ROLLBACK');
      const error = new Error('Admin account is locked');
      error.status = 403;
      error.errorCode = 'ADMIN_ACCOUNT_LOCKED';
      return next(error);
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(old_password, admin.password_hash);

    if (!isOldPasswordValid) {
      await client.query('ROLLBACK');
      const error = new Error('Old password is incorrect');
      error.status = 401;
      error.errorCode = 'INVALID_OLD_PASSWORD';
      return next(error);
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password and reset failed login attempts
    await client.query(
      `UPDATE admins 
       SET password_hash = $1, 
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, admin.id]
    );

    await client.query('COMMIT');

    // Log audit trail
    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'CHANGE_ADMIN_PASSWORD',
      entityType: 'admin',
      entityId: admin.id,
      details: { changed_by: req.user.id, changed_by_email: req.user.email }
    });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin-management/reset-password/:id
 * Reset admin password (SUPER_ADMIN only)
 */
router.put('/reset-password/:id', authorizeAdmin('SUPER_ADMIN'), validatePasswordReset, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { new_password } = req.body;

    // Check if admin exists
    const adminCheck = await client.query(
      'SELECT id, profile_id FROM admins WHERE id = $1',
      [id]
    );

    if (adminCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(new_password, 10);

    // Update password and reset failed login attempts
    await client.query(
      `UPDATE admins 
       SET password_hash = $1, 
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, id]
    );

    await client.query('COMMIT');

    // Log audit trail
    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'RESET_ADMIN_PASSWORD',
      entityType: 'admin',
      entityId: id,
      details: { reset_by: req.user.id }
    });

    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin-management/delete/:id
 * Delete admin (SUPER_ADMIN only)
 */
router.delete('/delete/:id', authorizeAdmin('SUPER_ADMIN'), async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Prevent self-deletion
    const ownAdminResult = await client.query(
      `SELECT a.id FROM admins a 
       JOIN profiles p ON a.profile_id = p.id 
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (ownAdminResult.rows.length > 0 && ownAdminResult.rows[0].id === id) {
      await client.query('ROLLBACK');
      const error = new Error('Cannot delete your own account');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_SELF';
      return next(error);
    }

    // Get admin data before deletion for audit
    const beforeResult = await client.query(
      `SELECT 
        a.*,
        p.email,
        p.full_name,
        p.phone
       FROM admins a
       JOIN profiles p ON a.profile_id = p.id
       WHERE a.id = $1`,
      [id]
    );

    if (beforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    const beforeData = beforeResult.rows[0];

    // Delete admin (profile will be cascade deleted if no other references)
    await client.query('DELETE FROM admins WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Log audit trail
    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'DELETE_ADMIN',
      entityType: 'admin',
      entityId: id,
      beforeValue: beforeData,
      afterValue: null,
      details: { deleted_by: req.user.id }
    });

    res.json({
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
