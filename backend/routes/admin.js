const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { requireSuperAdmin, requirePermission, loadUserPermissions } = require('../middleware/permissions');
const permissionsService = require('../services/permissions.service');
const {
  validateBookingStatusUpdate,
  validateTrainerCreation,
  validateTrainerUpdate,
  validateTrainerDelete,
  validateUserUpdate,
  validateUserRoleUpdate,
  validateUserCreation,
  validateSettingsUpdate,
  validateAdminChangePassword,
  validateAdminResetPassword,
  validateAdminAccountCreation,
  validateSubAdminCreation,
  validateAdminAccountUpdate,
  validateSubAdminUpdate,
  validateOfflineBookingCreation
} = require('../validators');
const auditService = require('../services/audit.service');
const slotCapacityService = require('../services/slotCapacity.service');
const notificationService = require('../services/notification.service');
const reactivationService = require('../services/reactivationRequest.service');
const overdueBookingService = require('../services/overdueBooking.service');
const { getDashboardStats } = require('../services/dashboardStats.service');
const { buildBookingListQuery, rowsToCsv } = require('../utils/bookingSearch');
const { enrichBookingTimes } = require('../utils/bookingTimeFormat');
const offlineBookingService = require('../services/offlineBooking.service');
const offlineCustomerSearchService = require('../services/offlineCustomerSearch.service');
const bookingAdminService = require('../services/bookingAdmin.service');
const bookingAttendanceService = require('../services/bookingAttendance.service');
const { logBookingEvent, EVENT_TYPES } = require('../services/bookingEvent.service');
const { buildAdminUsersListQuery, LATEST_BOOKING_PHONE_SQL } = require('../utils/adminUsersQuery');
const { enrichUsersWithDisplayPhone } = require('../utils/userPhone');
const { runOverdueBookingDetection } = require('../services/overdueDetection.service');
const { getClientIp } = require('../utils/authCookie');
const trainerDeletionService = require('../services/trainerDeletion.service');
const router = express.Router();

router.use(authenticate);
router.use(loadUserPermissions);
router.use(authorize('admin', 'superadmin', 'subadmin'));

router.put('/change-password', validateAdminChangePassword, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const ip = getClientIp(req);

    const userResult = await db.query(
      'SELECT id, email, role, password_hash FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    const user = userResult.rows[0];

    if (!user.password_hash) {
      const error = new Error('Password login is not configured for this account');
      error.status = 400;
      error.errorCode = 'NO_PASSWORD_SET';
      return next(error);
    }

    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      const error = new Error('Current password is incorrect');
      error.status = 401;
      error.errorCode = 'INVALID_CURRENT_PASSWORD';
      return next(error);
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await db.query(
      `UPDATE profiles
       SET password_hash = $1, must_change_password = false, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, req.user.id]
    );

    await auditService.logPasswordChanged(req.user.id, ip);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

function mapAdminBookingRow(row) {
  return enrichBookingTimes({
    id: row.id,
    user_id: row.user_id,
    slot_id: row.slot_id,
    trainer_id: row.trainer_id,
    vehicle_id: row.vehicle_id,
    status: row.status,
    notes: row.notes,
    phone: row.phone,
    created_at: row.created_at,
    updated_at: row.updated_at,
    start_time: row.start_time,
    end_time: row.end_time,
    slot_date: row.slot_date,
    user: {
      id: row.user_id,
      full_name: row.user_name,
      email: row.user_email
    },
    trainer: {
      id: row.trainer_table_id,
      profile: {
        id: row.trainer_profile_id,
        full_name: row.trainer_name
      }
    },
    slot: {
      start_time: row.start_time,
      end_time: row.end_time,
      slot_date: row.slot_date,
      capacity_exceeded: row.capacity_exceeded
    },
    vehicle_name: row.vehicle_name,
    booking_source: row.booking_source || 'ONLINE',
    offline_reference_number: row.offline_reference_number,
    attendance_status: row.attendance_status || 'SCHEDULED',
    created_by_admin_id: row.created_by_admin_id,
    created_by_admin_name: row.created_by_admin_name,
    created_by_admin_role: row.created_by_admin_role,
    updated_by_admin_name: row.updated_by_admin_name,
    updated_by_admin_role: row.updated_by_admin_role,
    attendance_updated_by_name: row.attendance_updated_by_name,
    attendance_updated_by_role: row.attendance_updated_by_role,
    attendance_updated_at: row.attendance_updated_at,
    offline_customer_name: row.offline_customer_name,
    offline_customer_age: row.offline_customer_age,
    offline_customer_gender: row.offline_customer_gender,
    user_name: row.user_name,
    user_email: row.user_email,
    trainer_name: row.trainer_name
  });
}

router.get('/bookings', requirePermission('bookings', 'view'), async (req, res, next) => {
  try {
    const { countSql, listSql, countParams, listParams, limit, offset } = buildBookingListQuery({
      status: req.query.status ? String(req.query.status).trim() : '',
      source: req.query.source ? String(req.query.source).trim().toUpperCase() : '',
      attendance: req.query.attendance ? String(req.query.attendance).trim() : '',
      startDate: req.query.startDate ? String(req.query.startDate).trim() : '',
      endDate: req.query.endDate ? String(req.query.endDate).trim() : '',
      searchRaw: req.query.search != null ? String(req.query.search).trim() : '',
      limit: req.query.limit,
      offset: req.query.offset
    });

    const countResult = await db.query(countSql, countParams);
    const total = Number(countResult.rows[0]?.total) || 0;

    const result = await db.query(listSql, listParams);

    const bookings = result.rows.map((row) => mapAdminBookingRow(row));

    res.json({ bookings, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/export', requirePermission('bookings', 'view'), async (req, res, next) => {
  try {
    const { listSql, listParams } = buildBookingListQuery({
      status: req.query.status ? String(req.query.status).trim() : '',
      source: req.query.source ? String(req.query.source).trim().toUpperCase() : '',
      attendance: req.query.attendance ? String(req.query.attendance).trim() : '',
      startDate: req.query.startDate ? String(req.query.startDate).trim() : '',
      endDate: req.query.endDate ? String(req.query.endDate).trim() : '',
      searchRaw: req.query.search != null ? String(req.query.search).trim() : '',
      limit: 5000,
      offset: 0
    });

    const result = await db.query(listSql, listParams);
    const exportRows = result.rows.map((row) => {
      const slotStart = row.start_time ? new Date(row.start_time) : null;
      const slotTime =
        slotStart && !Number.isNaN(slotStart.getTime())
          ? slotStart.toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
          : '';
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      const createdDate =
        createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : '';

      return {
        'Reference Number': row.offline_reference_number || row.id,
        Source: row.booking_source || 'ONLINE',
        'Attendance Status': row.attendance_status || 'SCHEDULED',
        'Created By':
          row.booking_source === 'OFFLINE' ? row.created_by_admin_name || 'Admin' : 'Self',
        'Created Date': createdDate,
        Vehicle: row.vehicle_name || '',
        Trainer: row.trainer_name || '',
        'Customer Name':
          row.booking_source === 'OFFLINE' ? row.offline_customer_name : row.user_name,
        Phone: row.phone || '',
        'Booking Date': row.slot_date || '',
        'Slot Time': slotTime
      };
    });

    if (exportRows.length === 0) {
      const error = new Error('No bookings found for export');
      error.status = 404;
      error.errorCode = 'NO_BOOKINGS_FOUND';
      return next(error);
    }

    const csv = rowsToCsv(exportRows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bookings_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/overdue', requirePermission('bookings', 'view'), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const bookings = await overdueBookingService.listOverdueBookings(limit);
    const total = await overdueBookingService.countOverdueBookings();
    res.json({ bookings, total });
  } catch (error) {
    next(error);
  }
});

router.get('/bookings/:id', requirePermission('bookings', 'view'), async (req, res, next) => {
  try {
    const booking = await bookingAdminService.getBookingDetail(req.params.id);
    if (!booking) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

router.put('/bookings/:id/attendance', requirePermission('bookings', 'edit'), async (req, res, next) => {
  try {
    const { attendance_status: attendanceStatus } = req.body;
    const updated = await bookingAttendanceService.updateBookingAttendance(
      req.user.id,
      req.params.id,
      attendanceStatus
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/offline-bookings/customers/search',
  requirePermission('bookings', 'create'),
  async (req, res, next) => {
    try {
      const matches = await offlineCustomerSearchService.searchOfflineCustomers({
        phone: req.query.phone,
        name: req.query.name,
        limit: req.query.limit
      });
      res.json({ matches });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/offline-bookings',
  requirePermission('bookings', 'create'),
  validateOfflineBookingCreation,
  async (req, res, next) => {
    try {
      const booking = await offlineBookingService.createOfflineBooking(req.user.id, req.body);
      res.status(201).json(booking);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/users', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const role = req.query.role != null ? String(req.query.role).trim() : '';
    const search = req.query.search != null ? String(req.query.search).trim() : '';
    const limit = req.query.limit;
    const offset = req.query.offset;

    const { countSql, countParams, listSql, listParams, limit: safeLimit, offset: safeOffset } =
      buildAdminUsersListQuery({ role, search, limit, offset });

    console.log('[Admin] GET /users', { role: role || null, search: search || null, limit: safeLimit, offset: safeOffset });

    const [countResult, listResult] = await Promise.all([
      db.query(countSql, countParams),
      db.query(listSql, listParams)
    ]);

    const total = Number(countResult.rows[0]?.total) || 0;
    const { users, stats } = enrichUsersWithDisplayPhone(listResult.rows);

    console.log('[Admin] GET /users result', {
      total,
      returned: users.length,
      missingPhone: stats.missingPhone,
      profilePhone: stats.profilePhoneCount,
      bookingPhone: stats.bookingPhoneCount
    });

    res.json({
      users,
      total,
      limit: safeLimit || null,
      offset: safeOffset
    });
  } catch (error) {
    const missingColumn = /column|does not exist|42703/i.test(String(error.message || ''));
    if (!missingColumn) {
      console.error('[Admin] GET /users failed:', error.message);
      return next(error);
    }

    console.warn('[Admin] GET /users falling back to minimal profile query:', error.message);
    try {
      const role = req.query.role != null ? String(req.query.role).trim() : '';
      const search = req.query.search != null ? String(req.query.search).trim() : '';
      const conditions = [];
      const params = [];
      let idx = 1;
      if (role) {
        conditions.push(`p.role = $${idx++}`);
        params.push(role);
      }
      if (search) {
        conditions.push(`(
          COALESCE(p.full_name, '') ILIKE $${idx} OR
          COALESCE(p.email, '') ILIKE $${idx} OR
          COALESCE(p.phone::text, '') ILIKE $${idx}
        )`);
        params.push(`%${search}%`);
        idx++;
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const fallback = await db.query(
        `SELECT p.id, p.email, p.full_name, p.phone AS profile_phone, p.role, p.created_at,
                p.google_id,
                ${LATEST_BOOKING_PHONE_SQL} AS latest_booking_phone
         FROM profiles p ${whereSql}
         ORDER BY p.created_at DESC`,
        params
      );
      const enriched = enrichUsersWithDisplayPhone(
        fallback.rows.map((row) => ({
          ...row,
          inactive_blocked: false,
          total_bookings: 0,
          active_bookings: 0
        }))
      );
      console.log('[Admin] GET /users fallback result', {
        returned: enriched.users.length,
        missingPhone: enriched.stats.missingPhone,
        bookingPhone: enriched.stats.bookingPhoneCount
      });
      return res.json({
        users: enriched.users,
        total: enriched.users.length,
        limit: null,
        offset: 0
      });
    } catch (fallbackError) {
      console.error('[Admin] GET /users fallback failed:', fallbackError.message);
      return next(fallbackError);
    }
  }
});

// Get customers only (with booking stats)
router.get('/customers', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        p.phone, 
        p.created_at,
        p.total_bookings,
        p.last_booking_date,
        p.weekly_booking_count,
        p.weekly_reset_date,
        p.inactive_blocked,
        COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
        COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
        COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings
      FROM profiles p
      LEFT JOIN bookings b ON p.id = b.user_id
      WHERE p.role = 'customer'
    `;
    
    const params = [];
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        p.full_name ILIKE $${params.length} OR 
        p.email ILIKE $${params.length} OR 
        p.phone ILIKE $${params.length}
      )`;
    }
    
    query += `
      GROUP BY p.id, p.email, p.full_name, p.phone, p.created_at, 
               p.total_bookings, p.last_booking_date, p.weekly_booking_count, p.weekly_reset_date,
               p.inactive_blocked
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Export customers to CSV
router.get('/customers/export', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;
    
    const result = await db.query(`
      SELECT 
        p.full_name as "Full Name",
        p.phone as "Phone",
        p.email as "Email",
        p.total_bookings as "Total Bookings",
        p.last_booking_date as "Last Booking Date",
        p.weekly_booking_count as "Weekly Booking Count",
        p.created_at as "Registration Date"
      FROM profiles p
      WHERE p.role = 'customer'
      ORDER BY p.created_at DESC
    `);

    if (format === 'csv') {
      if (result.rows.length === 0) {
        const error = new Error('No customers found');
        error.status = 404;
        error.errorCode = 'NO_CUSTOMERS_FOUND';
        return next(error);
      }

      // Generate CSV
      const headers = Object.keys(result.rows[0]);
      const csvRows = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="customers_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else if (format === 'json') {
      res.json(result.rows);
    } else {
      const error = new Error('Invalid format. Use "csv" or "json"');
      error.status = 400;
      error.errorCode = 'INVALID_FORMAT';
      return next(error);
    }
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    await runOverdueBookingDetection().catch(() => {});
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Alias for dashboard
router.get('/stats', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    await runOverdueBookingDetection().catch(() => {});
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = parseInt(req.query.offset, 10) || 0;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const result = await notificationService.listNotifications(req.user.id, {
      limit,
      offset,
      unreadOnly
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/unread-count', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/:id/read', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    await notificationService.markRead(req.user.id, req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/read-all', requirePermission('dashboard', 'view'), async (req, res, next) => {
  try {
    const marked = await notificationService.markAllRead(req.user.id);
    res.json({ message: 'All notifications marked as read', marked });
  } catch (error) {
    next(error);
  }
});

router.post('/slots/recalculate-capacity', requirePermission('slots', 'edit'), async (req, res, next) => {
  try {
    const result = await slotCapacityService.recalculateFutureSlotCapacities(req.user.id);
    res.json({
      message: 'Slot capacities recalculated for all slots from today onward',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// Get all trainers with their profile information
router.get('/trainers', requirePermission('trainers', 'view'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*,
             p.id as profile_id, p.email, p.full_name, p.phone, p.avatar_url, p.role
      FROM trainers t
      JOIN profiles p ON t.user_id = p.id
      ORDER BY t.created_at DESC
    `);

    // Format response to match frontend expectations
    const trainers = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      bio: row.bio,
      experience_years: row.experience_years,
      specialization: row.specialization,
      rating: parseFloat(row.rating) || 0,
      total_sessions: row.total_sessions,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      profile: {
        id: row.profile_id,
        email: row.email,
        full_name: row.full_name,
        phone: row.phone,
        avatar_url: row.avatar_url,
        role: row.role
      }
    }));

    res.json(trainers);
  } catch (error) {
    next(error);
  }
});

// Create trainer
router.post('/trainers', requirePermission('trainers', 'create'), validateTrainerCreation, async (req, res, next) => {
  try {
    const { email, full_name, phone, bio, experience_years, specialization, rating } = req.body;

    if (!email || !full_name || !bio) {
      const error = new Error('Missing required fields');
      error.status = 400;
      error.errorCode = 'MISSING_REQUIRED_FIELDS';
      return next(error);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Phone is required - generate default if not provided for trainers
      const finalPhone = phone || `TRAINER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const profileResult = await client.query(
        `INSERT INTO profiles (email, full_name, phone, role)
         VALUES ($1, $2, $3, 'trainer')
         RETURNING id`,
        [email, full_name, finalPhone]
      );

      const userId = profileResult.rows[0].id;

      const trainerResult = await client.query(
        `INSERT INTO trainers (user_id, bio, experience_years, specialization, is_active, rating)
         VALUES ($1, $2, $3, $4, true, $5)
         RETURNING *`,
        [userId, bio, experience_years || 0, specialization || [], rating != null ? rating : 0]
      );

      await client.query('COMMIT');

      const created = trainerResult.rows[0];
      await auditService.logTrainerCreate(req.user.id, {
        id: created.id,
        user_id: created.user_id,
        bio: created.bio,
        is_active: created.is_active
      });

      res.status(201).json({
        ...created,
        profile: profileResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '23505') {
      const error = new Error('Email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      return next(error);
    }
    next(error);
  }
});

// Update trainer
router.put('/trainers/:id', requirePermission('trainers', 'edit'), validateTrainerUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, bio, experience_years, specialization, full_name, phone, rating } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio);
    }
    if (experience_years !== undefined) {
      updates.push(`experience_years = $${paramCount++}`);
      values.push(experience_years);
    }
    if (specialization !== undefined) {
      updates.push(`specialization = $${paramCount++}`);
      values.push(specialization);
    }
    if (rating !== undefined) {
      updates.push(`rating = $${paramCount++}`);
      values.push(rating);
    }

    if (updates.length === 0 && !full_name && !phone) {
      const error = new Error('No fields to update');
      error.status = 400;
      error.errorCode = 'NO_FIELDS_TO_UPDATE';
      return next(error);
    }

    const beforeResult = await db.query(
      `SELECT t.id, t.bio, t.experience_years, t.specialization, t.rating, t.is_active, p.full_name, p.phone
       FROM trainers t JOIN profiles p ON t.user_id = p.id WHERE t.id = $1`,
      [id]
    );
    if (beforeResult.rows.length === 0) {
      const error = new Error('Trainer not found');
      error.status = 404;
      error.errorCode = 'TRAINER_NOT_FOUND';
      return next(error);
    }
    const beforeData = beforeResult.rows[0];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.length > 0) {
        values.push(id);
        const query = `UPDATE trainers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        await client.query(query, values);
      }

      if (full_name || phone) {
        const profileUpdates = [];
        const profileValues = [];
        let profileParamCount = 1;

        if (full_name) {
          profileUpdates.push(`full_name = $${profileParamCount++}`);
          profileValues.push(full_name);
        }
        if (phone !== undefined) {
          profileUpdates.push(`phone = $${profileParamCount++}`);
          profileValues.push(phone);
        }

        profileValues.push(id);
        const profileQuery = `UPDATE profiles SET ${profileUpdates.join(', ')} WHERE id = (SELECT user_id FROM trainers WHERE id = $${profileParamCount}) RETURNING *`;
        await client.query(profileQuery, profileValues);
      }

      const result = await client.query(
        `SELECT t.*, p.id as profile_id, p.email, p.full_name, p.phone, p.avatar_url, p.role
         FROM trainers t
         JOIN profiles p ON t.user_id = p.id
         WHERE t.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        const error = new Error('Trainer not found');
        error.status = 404;
        error.errorCode = 'TRAINER_NOT_FOUND';
        return next(error);
      }

      await client.query('COMMIT');

      const row = result.rows[0];
      const afterData = {
        id: row.id,
        bio: row.bio,
        experience_years: row.experience_years,
        specialization: row.specialization,
        rating: parseFloat(row.rating),
        is_active: row.is_active,
        full_name: row.full_name,
        phone: row.phone
      };
      await auditService.logTrainerUpdate(req.user.id, id, beforeData, afterData);

      res.json({
        id: row.id,
        user_id: row.user_id,
        bio: row.bio,
        experience_years: row.experience_years,
        specialization: row.specialization,
        rating: parseFloat(row.rating),
        total_sessions: row.total_sessions,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile: {
          id: row.profile_id,
          email: row.email,
          full_name: row.full_name,
          phone: row.phone,
          avatar_url: row.avatar_url,
          role: row.role
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Trainer delete preview (booking summary)
router.get('/trainers/:id/delete-preview', requirePermission('trainers', 'delete'), async (req, res, next) => {
  try {
    const preview = await trainerDeletionService.getTrainerDeletePreview(req.params.id);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

// Delete trainer with optional strategy (direct | complete_all | reassign)
router.delete('/trainers/:id', requirePermission('trainers', 'delete'), validateTrainerDelete, async (req, res, next) => {
  try {
    const strategy = req.body?.strategy || 'direct';
    const reassignToTrainerId = req.body?.reassignToTrainerId;

    const result = await trainerDeletionService.deleteTrainerWithStrategy({
      trainerId: req.params.id,
      adminId: req.user.id,
      strategy,
      reassignToTrainerId
    });

    res.json(result);
  } catch (error) {
    if (error.code === '23503') {
      const fkError = new Error('Cannot delete trainer. This trainer has related data that must be removed first');
      fkError.status = 400;
      fkError.errorCode = 'CANNOT_DELETE_TRAINER';
      return next(fkError);
    }
    next(error);
  }
});

/** Legacy admin slot CRUD removed — slots are created by automation (cron) and public /api/slots. */
router.use('/slots', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    errorCode: 'ADMIN_SLOTS_DEPRECATED',
    message:
      'Admin slot management has been removed. Slots are auto-generated; use GET /api/slots for read-only access if needed.'
  });
});

// Get settings
router.get('/settings', requirePermission('settings', 'view'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM settings ORDER BY key');
    
    // Convert to object format
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updated_at: row.updated_at,
        updated_by: row.updated_by
      };
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Update settings
router.put('/settings', requirePermission('settings', 'edit'), validateSettingsUpdate, async (req, res, next) => {
  try {
    const settings = req.body;
    const userId = req.user.id;

    const beforeRows = await db.query('SELECT key, value FROM settings');
    const beforeSettings = {};
    beforeRows.rows.forEach((r) => { beforeSettings[r.key] = r.value; });

    for (const [key, data] of Object.entries(settings)) {
      const { value } = data;
      
      await db.query(`
        INSERT INTO settings (key, value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      `, [key, JSON.stringify(value), data.description || '', userId]);
    }

    const afterSettings = { ...beforeSettings };
    for (const [key, data] of Object.entries(settings)) {
      afterSettings[key] = data.value;
    }
    await auditService.logSettingsUpdate(userId, beforeSettings, afterSettings);

    const capacitySettingChanged = Object.prototype.hasOwnProperty.call(settings, 'auto_slot_capacity_from_vehicles');
    if (capacitySettingChanged) {
      await slotCapacityService.recalculateFutureSlotCapacities(userId);
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Update booking status
router.put('/bookings/:id/status', requirePermission('bookings', 'edit'), validateBookingStatusUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log(`[Admin] Updating booking ${id} status to: ${status}`);

    if (!status) {
      const error = new Error('Status is required');
      error.status = 400;
      error.errorCode = 'STATUS_REQUIRED';
      return next(error);
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      const error = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      error.status = 400;
      error.errorCode = 'INVALID_STATUS';
      return next(error);
    }

    // Check if booking exists
    const bookingCheck = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingCheck.rows.length === 0) {
      console.error(`[Admin] Booking not found: ${id}`);
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    const oldStatus = bookingCheck.rows[0].status;
    console.log(`[Admin] Booking ${id} status change: ${oldStatus} -> ${status}`);

    // Update booking status
    const result = await db.query(
      `UPDATE bookings
       SET status = $1, updated_by_admin_id = $3, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id, req.user.id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    const updatedBooking = result.rows[0];
    console.log(`[Admin] Booking ${id} status updated successfully to: ${updatedBooking.status}`);

    await auditService.logBookingStatusChange(req.user.id, id, bookingCheck.rows[0], status);

    const eventType =
      status === 'cancelled'
        ? EVENT_TYPES.BOOKING_CANCELLED
        : status === 'completed'
          ? EVENT_TYPES.BOOKING_COMPLETED
          : EVENT_TYPES.BOOKING_UPDATED;
    const eventTitle =
      status === 'cancelled'
        ? 'Booking Cancelled'
        : status === 'completed'
          ? 'Booking Completed'
          : 'Booking Updated';
    await logBookingEvent({
      bookingId: id,
      eventType,
      title: eventTitle,
      description: `Status changed from ${oldStatus} to ${status}`,
      actorId: req.user.id,
      metadata: { from: oldStatus, to: status }
    });

    if (status === 'completed') {
      await auditService.logBookingCompleted(req.user.id, id, {
        source: 'admin_status_update',
        previous_status: oldStatus
      });
      notificationService.createNotification({
        type: 'booking_completed',
        title: 'Booking marked completed',
        body: `Booking ${id.slice(0, 8)}… was marked completed.`,
        entity_type: 'booking',
        entity_id: id,
        dedupeHours: 1
      }).catch(() => {});
    } else if (status === 'cancelled') {
      notificationService.createNotification({
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: `Booking ${id.slice(0, 8)}… was cancelled by admin.`,
        entity_type: 'booking',
        entity_id: id,
        dedupeHours: 1
      }).catch(() => {});
    }

    res.json(updatedBooking);
  } catch (error) {
    console.error(`[Admin] Error updating booking status:`, error);
    next(error);
  }
});

// Assign trainer to booking (admin only; does not affect customer booking create flow)
router.put('/bookings/:id/trainer', requirePermission('bookings', 'edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const trainer_id = req.body?.trainer_id || null;

    const bookingCheck = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (bookingCheck.rows.length === 0) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    if (trainer_id) {
      const trainerCheck = await db.query(
        'SELECT id FROM trainers WHERE id = $1 AND is_active = true',
        [trainer_id]
      );
      if (trainerCheck.rows.length === 0) {
        const error = new Error('Trainer not found or inactive');
        error.status = 400;
        error.errorCode = 'TRAINER_INACTIVE';
        return next(error);
      }

      const dup = await db.query(
        `SELECT id FROM bookings
         WHERE slot_id = $1 AND trainer_id = $2 AND id != $3 AND status NOT IN ('cancelled')`,
        [bookingCheck.rows[0].slot_id, trainer_id, id]
      );
      if (dup.rows.length > 0) {
        const error = new Error('This trainer is already assigned for this slot');
        error.status = 409;
        error.errorCode = 'TRAINER_SLOT_TAKEN';
        return next(error);
      }
    }

    const oldTrainerId = bookingCheck.rows[0].trainer_id;

    const result = await db.query(
      `UPDATE bookings
       SET trainer_id = $1, updated_by_admin_id = $3, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [trainer_id, id, req.user.id]
    );

    if (trainer_id) {
      const trainerNameRow = await db.query(
        `SELECT p.full_name FROM trainers t JOIN profiles p ON t.user_id = p.id WHERE t.id = $1`,
        [trainer_id]
      );
      const trainerName = trainerNameRow.rows[0]?.full_name || 'Trainer';
      await logBookingEvent({
        bookingId: id,
        eventType: EVENT_TYPES.TRAINER_ASSIGNED,
        title: 'Trainer Assigned',
        description: trainerName,
        actorId: req.user.id,
        metadata: { trainer_id, previous_trainer_id: oldTrainerId }
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete booking
router.delete('/bookings/:id', requirePermission('bookings', 'delete'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      const error = new Error('Booking not found');
      error.status = 404;
      error.errorCode = 'BOOKING_NOT_FOUND';
      return next(error);
    }

    await auditService.logBookingDelete(req.user.id, result.rows[0]);

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Create admin user (superadmin only)
router.post('/users', validateUserCreation, async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can create admin users');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { email, full_name, phone, role } = req.body;

    if (!email || !full_name || !role) {
      const error = new Error('Missing required fields');
      error.status = 400;
      error.errorCode = 'MISSING_REQUIRED_FIELDS';
      return next(error);
    }

    // Phone is required - generate default if not provided
    if (!phone) {
      const error = new Error('Phone number is required');
      error.status = 400;
      error.errorCode = 'PHONE_REQUIRED';
      return next(error);
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      const error = new Error('Invalid role');
      error.status = 400;
      error.errorCode = 'INVALID_ROLE';
      return next(error);
    }

    const result = await db.query(
      `INSERT INTO profiles (email, full_name, phone, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, role, created_at`,
      [email, full_name, phone, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      const error = new Error('Email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      return next(error);
    }
    next(error);
  }
});

// Super admin password reset for admin/subadmin accounts
router.put('/users/:id/reset-password', requireSuperAdmin, validateAdminResetPassword, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const targetResult = await db.query(
      'SELECT id, email, role FROM profiles WHERE id = $1',
      [id]
    );

    if (targetResult.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    const target = targetResult.rows[0];

    if (target.role === 'superadmin') {
      const error = new Error('Cannot reset super admin passwords');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    if (!['admin', 'subadmin'].includes(target.role)) {
      const error = new Error('Password reset is only allowed for admin and sub admin accounts');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE profiles
       SET password_hash = $1, must_change_password = true, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, id]
    );

    await auditService.logPasswordReset(req.user.id, id, { target_role: target.role });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

// Update user (admin can edit customer details)
router.put('/users/:id', requirePermission('users', 'edit'), validateUserUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, total_bookings, weekly_booking_count, inactive_blocked } = req.body;

    const beforeSnap = await db.query(
      `SELECT id, email, full_name, phone, role, created_at, total_bookings, last_booking_date, weekly_booking_count, inactive_blocked
       FROM profiles WHERE id = $1`,
      [id]
    );

    if (beforeSnap.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      params.push(full_name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (total_bookings !== undefined) {
      updates.push(`total_bookings = $${paramIndex++}`);
      params.push(total_bookings);
    }
    if (weekly_booking_count !== undefined) {
      updates.push(`weekly_booking_count = $${paramIndex++}`);
      params.push(weekly_booking_count);
    }
    if (inactive_blocked !== undefined) {
      updates.push(`inactive_blocked = $${paramIndex++}`);
      params.push(!!inactive_blocked);
    }

    if (updates.length === 0) {
      const error = new Error('No fields to update');
      error.status = 400;
      error.errorCode = 'NO_FIELDS_TO_UPDATE';
      return next(error);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, full_name, phone, role, created_at, total_bookings, last_booking_date, weekly_booking_count, inactive_blocked`,
      params
    );

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_USER_PROFILE',
      entityType: 'user',
      entityId: id,
      beforeValue: beforeSnap.rows[0],
      afterValue: result.rows[0],
      details: {}
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      const error = new Error('Phone number or email already exists');
      error.status = 409;
      error.errorCode = 'DUPLICATE_CONTACT';
      return next(error);
    }
    next(error);
  }
});

// Update user role (superadmin only)
router.put('/users/:id/role', validateUserRoleUpdate, async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can change user roles');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      const error = new Error('Role is required');
      error.status = 400;
      error.errorCode = 'ROLE_REQUIRED';
      return next(error);
    }

    const validRoles = ['customer', 'trainer', 'admin', 'superadmin'];
    if (!validRoles.includes(role)) {
      const error = new Error('Invalid role');
      error.status = 400;
      error.errorCode = 'INVALID_ROLE';
      return next(error);
    }

    // Get old data for audit
    const oldData = await db.query(
      'SELECT role FROM profiles WHERE id = $1',
      [id]
    );

    const result = await db.query(
      'UPDATE profiles SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, phone, role, created_at',
      [role, id]
    );

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_USER_ROLE',
      entityType: 'user',
      entityId: id,
      beforeValue: oldData.rows[0] || {},
      afterValue: result.rows[0],
      details: {}
    });

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete user (superadmin only)
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'superadmin') {
      const error = new Error('Only superadmins can delete users');
      error.status = 403;
      error.errorCode = 'FORBIDDEN';
      return next(error);
    }

    const { id } = req.params;

    if (id === req.user.id) {
      const error = new Error('Cannot delete your own account');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_OWN_ACCOUNT';
      return next(error);
    }

    // Get old data for audit
    const oldData = await db.query('SELECT * FROM profiles WHERE id = $1', [id]);

    const result = await db.query('DELETE FROM profiles WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      const error = new Error('User not found');
      error.status = 404;
      error.errorCode = 'USER_NOT_FOUND';
      return next(error);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      beforeValue: oldData.rows[0] || {},
      afterValue: null,
      details: {}
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      const error = new Error('Cannot delete user. This user has related data that must be removed first');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_USER';
      return next(error);
    }
    next(error);
  }
});

router.get('/reactivation-requests', requirePermission('users', 'view'), async (req, res, next) => {
  try {
    const status = req.query.status != null ? String(req.query.status).trim() : '';
    const limit = req.query.limit;
    const offset = req.query.offset;
    const result = await reactivationService.listForAdmin({ status, limit, offset });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put('/reactivation-requests/:id/approve', requirePermission('users', 'edit'), async (req, res, next) => {
  try {
    const updated = await reactivationService.approveRequest(req.params.id, req.user.id);
    res.json({
      success: true,
      message: 'Account reactivated successfully',
      request: updated
    });
  } catch (error) {
    next(error);
  }
});

router.put('/reactivation-requests/:id/reject', requirePermission('users', 'edit'), async (req, res, next) => {
  try {
    const adminNotes = req.body?.admin_notes || req.body?.adminNotes || null;
    const updated = await reactivationService.rejectRequest(req.params.id, req.user.id, adminNotes);
    res.json({
      success: true,
      message: 'Reactivation request rejected',
      request: updated
    });
  } catch (error) {
    next(error);
  }
});

// Get admin audit logs (admin only)
router.get('/audit-logs', requirePermission('audit_logs', 'view'), async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, entity_type, action_type, admin_id } = req.query;
    const safeLimit = Number.parseInt(limit, 10);
    const safeOffset = Number.parseInt(offset, 10);
    const finalLimit = Number.isFinite(safeLimit) ? Math.min(Math.max(safeLimit, 1), 1000) : 100;
    const finalOffset = Number.isFinite(safeOffset) ? Math.max(safeOffset, 0) : 0;

    const hasAdminAuditLog = await db
      .query(`SELECT to_regclass('public.admin_audit_log') IS NOT NULL AS exists`)
      .then((r) => !!r.rows[0]?.exists);
    const hasLegacyAuditLog = await db
      .query(`SELECT to_regclass('public.audit_logs') IS NOT NULL AS exists`)
      .then((r) => !!r.rows[0]?.exists);

    if (!hasAdminAuditLog && !hasLegacyAuditLog) {
      return res.json([]);
    }

    const params = [];
    let paramIndex = 1;
    let adminFilterSql = '';
    let legacyFilterSql = '';

    if (entity_type) {
      params.push(entity_type);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.entity_type = ${token}`;
      legacyFilterSql += ` AND al.entity_type = ${token}`;
    }

    if (action_type) {
      params.push(action_type);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.action_type = ${token}`;
      legacyFilterSql += ` AND al.action = ${token}`;
    }

    if (admin_id) {
      params.push(admin_id);
      const token = `$${paramIndex++}`;
      adminFilterSql += ` AND al.admin_id = ${token}`;
      legacyFilterSql += ` AND al.user_id = ${token}`;
    }

    let query = '';
    if (hasAdminAuditLog) {
      query = `
        SELECT
          al.id,
          al.admin_id,
          p.full_name as admin_name,
          p.email as admin_email,
          al.action_type,
          al.entity_type,
          al.entity_id,
          al.before_value,
          al.after_value,
          al.details,
          al.created_at
        FROM admin_audit_log al
        LEFT JOIN profiles p ON al.admin_id = p.id
        WHERE 1=1 ${adminFilterSql}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
    } else {
      // Legacy compatibility for deployments still using audit_logs only.
      query = `
        SELECT
          al.id,
          al.user_id as admin_id,
          p.full_name as admin_name,
          p.email as admin_email,
          al.action as action_type,
          al.entity_type,
          al.entity_id,
          NULL::jsonb as before_value,
          al.changes as after_value,
          al.changes as details,
          al.created_at
        FROM audit_logs al
        LEFT JOIN profiles p ON al.user_id = p.id
        WHERE 1=1 ${legacyFilterSql}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
    }

    params.push(finalLimit, finalOffset);
    const result = await db.query(query, params);
    res.json(result.rows || []);
  } catch (error) {
    next(error);
  }
});

// --- Sub Admin Management (superadmin only) ---

router.get('/sub-admins', requireSuperAdmin, async (req, res, next) => {
  try {
    if (process.env.LOG_SUB_ADMINS_ROUTE === '1' || process.env.NODE_ENV === 'production') {
      console.log('[sub-admins] GET /api/admin/sub-admins reached', {
        userId: req.user?.id,
        role: req.user?.role,
        at: new Date().toISOString()
      });
    }

    const result = await db.query(
      `SELECT id, email, full_name, phone, role, admin_is_active, must_change_password, created_at, updated_at
       FROM profiles
       WHERE role = 'subadmin'
       ORDER BY created_at DESC`
    );

    const subAdmins = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        permissions: await permissionsService.getPermissionsList(row.id)
      }))
    );

    res.json(subAdmins);
  } catch (error) {
    next(error);
  }
});

router.get('/sub-admins/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, full_name, phone, role, admin_is_active, created_at, updated_at
       FROM profiles WHERE id = $1 AND role = 'subadmin'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Sub admin not found');
      error.status = 404;
      error.errorCode = 'SUB_ADMIN_NOT_FOUND';
      return next(error);
    }

    const subAdmin = result.rows[0];
    subAdmin.permissions = await permissionsService.getPermissionsList(subAdmin.id);
    res.json(subAdmin);
  } catch (error) {
    next(error);
  }
});

router.post('/sub-admins', requireSuperAdmin, validateSubAdminCreation, async (req, res, next) => {
  try {
    const { email, full_name, phone, password, permissions, admin_is_active } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedPhone = phone || `9${Date.now().toString().slice(-9)}`;
    const isActive = admin_is_active !== false;

    const result = await db.query(
      `INSERT INTO profiles (email, full_name, phone, role, password_hash, admin_is_active, must_change_password)
       VALUES ($1, $2, $3, 'subadmin', $4, $5, true)
       RETURNING id, email, full_name, phone, role, admin_is_active, must_change_password, created_at`,
      [email.trim().toLowerCase(), full_name.trim(), resolvedPhone, passwordHash, isActive]
    );

    const created = result.rows[0];
    created.permissions = await permissionsService.upsertPermissions(
      created.id,
      permissions || permissionsService.defaultSubAdminPermissions()
    );

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'CREATE_SUBADMIN',
      entityType: 'sub_admin',
      entityId: created.id,
      beforeValue: null,
      afterValue: { id: created.id, email: created.email, full_name: created.full_name },
      details: { permissions: created.permissions }
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Email or phone already exists');
      dup.status = 409;
      dup.errorCode = 'DUPLICATE_CONTACT';
      return next(dup);
    }
    next(error);
  }
});

router.put('/sub-admins/:id', requireSuperAdmin, validateSubAdminUpdate, async (req, res, next) => {
  try {
    const { full_name, email, phone, permissions, admin_is_active } = req.body;
    const before = await db.query(
      `SELECT id, email, full_name, phone, role, admin_is_active FROM profiles WHERE id = $1 AND role = 'subadmin'`,
      [req.params.id]
    );

    if (before.rows.length === 0) {
      const error = new Error('Sub admin not found');
      error.status = 404;
      error.errorCode = 'SUB_ADMIN_NOT_FOUND';
      return next(error);
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${idx++}`);
      params.push(full_name.trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(email.trim().toLowerCase());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      params.push(phone);
    }
    if (admin_is_active !== undefined) {
      updates.push(`admin_is_active = $${idx++}`);
      params.push(admin_is_active);
    }

    let updated = before.rows[0];
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(req.params.id);
      const result = await db.query(
        `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx}
         RETURNING id, email, full_name, phone, role, admin_is_active, must_change_password, created_at, updated_at`,
        params
      );
      updated = result.rows[0];
    }

    if (permissions !== undefined) {
      updated.permissions = await permissionsService.upsertPermissions(req.params.id, permissions);
    } else {
      updated.permissions = await permissionsService.getPermissionsList(req.params.id);
    }

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_SUBADMIN',
      entityType: 'sub_admin',
      entityId: req.params.id,
      beforeValue: before.rows[0],
      afterValue: updated,
      details: { permissions: updated.permissions }
    });

    res.json(updated);
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Email or phone already exists');
      dup.status = 409;
      dup.errorCode = 'DUPLICATE_CONTACT';
      return next(dup);
    }
    next(error);
  }
});

router.put('/sub-admins/:id/status', requireSuperAdmin, async (req, res, next) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      const error = new Error('is_active boolean is required');
      error.status = 400;
      error.errorCode = 'INVALID_STATUS';
      return next(error);
    }

    const before = await db.query(
      `SELECT id, email, admin_is_active FROM profiles WHERE id = $1 AND role = 'subadmin'`,
      [req.params.id]
    );
    if (before.rows.length === 0) {
      const error = new Error('Sub admin not found');
      error.status = 404;
      error.errorCode = 'SUB_ADMIN_NOT_FOUND';
      return next(error);
    }

    const result = await db.query(
      `UPDATE profiles SET admin_is_active = $1, updated_at = NOW()
       WHERE id = $2 AND role = 'subadmin'
       RETURNING id, email, full_name, phone, role, admin_is_active, created_at, updated_at`,
      [is_active, req.params.id]
    );

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: is_active ? 'ACTIVATE_SUB_ADMIN' : 'DEACTIVATE_SUB_ADMIN',
      entityType: 'sub_admin',
      entityId: req.params.id,
      beforeValue: before.rows[0],
      afterValue: result.rows[0],
      details: {}
    });

    const row = result.rows[0];
    row.permissions = await permissionsService.getPermissionsList(row.id);
    res.json(row);
  } catch (error) {
    next(error);
  }
});

router.delete('/sub-admins/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      const error = new Error('Cannot delete your own account');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_OWN_ACCOUNT';
      return next(error);
    }

    const before = await db.query(
      `SELECT id, email, full_name, role FROM profiles WHERE id = $1 AND role = 'subadmin'`,
      [id]
    );
    if (before.rows.length === 0) {
      const error = new Error('Sub admin not found');
      error.status = 404;
      error.errorCode = 'SUB_ADMIN_NOT_FOUND';
      return next(error);
    }

    await db.query('DELETE FROM sub_admin_permissions WHERE profile_id = $1', [id]);
    await db.query('DELETE FROM profiles WHERE id = $1', [id]);

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'DELETE_SUBADMIN',
      entityType: 'sub_admin',
      entityId: id,
      beforeValue: before.rows[0],
      afterValue: null,
      details: {}
    });

    res.json({ message: 'Sub admin deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      const err = new Error('Cannot delete sub admin due to related records');
      err.status = 400;
      err.errorCode = 'CANNOT_DELETE_SUB_ADMIN';
      return next(err);
    }
    next(error);
  }
});

router.get('/admins', requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, full_name, phone, role, admin_is_active, must_change_password, created_at, updated_at
       FROM profiles
       WHERE role = 'admin'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/admins', requireSuperAdmin, validateAdminAccountCreation, async (req, res, next) => {
  try {
    const { email, full_name, phone, password, admin_is_active } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedPhone = phone || `9${Date.now().toString().slice(-9)}`;
    const isActive = admin_is_active !== false;

    const result = await db.query(
      `INSERT INTO profiles (email, full_name, phone, role, password_hash, admin_is_active, must_change_password)
       VALUES ($1, $2, $3, 'admin', $4, $5, true)
       RETURNING id, email, full_name, phone, role, admin_is_active, must_change_password, created_at`,
      [email.trim().toLowerCase(), full_name.trim(), resolvedPhone, passwordHash, isActive]
    );

    const created = result.rows[0];

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'CREATE_ADMIN',
      entityType: 'admin',
      entityId: created.id,
      beforeValue: null,
      afterValue: created,
      details: {}
    });

    res.status(201).json(created);
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Email or phone already exists');
      dup.status = 409;
      dup.errorCode = 'DUPLICATE_CONTACT';
      return next(dup);
    }
    next(error);
  }
});

router.put('/admins/:id', requireSuperAdmin, validateAdminAccountUpdate, async (req, res, next) => {
  try {
    const { full_name, email, phone, admin_is_active } = req.body;
    const before = await db.query(
      `SELECT id, email, full_name, phone, role, admin_is_active FROM profiles WHERE id = $1 AND role = 'admin'`,
      [req.params.id]
    );

    if (before.rows.length === 0) {
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${idx++}`);
      params.push(full_name.trim());
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(email.trim().toLowerCase());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      params.push(phone);
    }
    if (admin_is_active !== undefined) {
      updates.push(`admin_is_active = $${idx++}`);
      params.push(admin_is_active);
    }

    if (updates.length === 0) {
      return res.json(before.rows[0]);
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);
    const result = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, full_name, phone, role, admin_is_active, must_change_password, created_at, updated_at`,
      params
    );

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'UPDATE_ADMIN',
      entityType: 'admin',
      entityId: req.params.id,
      beforeValue: before.rows[0],
      afterValue: result.rows[0],
      details: {}
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      const dup = new Error('Email or phone already exists');
      dup.status = 409;
      dup.errorCode = 'DUPLICATE_CONTACT';
      return next(dup);
    }
    next(error);
  }
});

router.delete('/admins/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      const error = new Error('Cannot delete your own account');
      error.status = 400;
      error.errorCode = 'CANNOT_DELETE_OWN_ACCOUNT';
      return next(error);
    }

    const before = await db.query(
      `SELECT id, email, full_name, role FROM profiles WHERE id = $1 AND role = 'admin'`,
      [id]
    );
    if (before.rows.length === 0) {
      const error = new Error('Admin not found');
      error.status = 404;
      error.errorCode = 'ADMIN_NOT_FOUND';
      return next(error);
    }

    await db.query('DELETE FROM profiles WHERE id = $1', [id]);

    await auditService.logAdminAction({
      adminId: req.user.id,
      actionType: 'DELETE_ADMIN',
      entityType: 'admin',
      entityId: id,
      beforeValue: before.rows[0],
      afterValue: null,
      details: {}
    });

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    if (error.code === '23503') {
      const err = new Error('Cannot delete admin due to related records');
      err.status = 400;
      err.errorCode = 'CANNOT_DELETE_ADMIN';
      return next(err);
    }
    next(error);
  }
});

module.exports = router;
