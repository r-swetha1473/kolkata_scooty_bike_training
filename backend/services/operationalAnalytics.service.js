/**
 * Read-only operational analytics for admin dashboard (Phase 2.1).
 * Does not modify booking, capacity, attendance, or OAuth workflows.
 */

const db = require('../db');

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

function toCount(rows, field = 'count') {
  const raw = rows[0]?.[field];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

let cachedDeploymentVersion = null;

function getDeploymentVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  if (cachedDeploymentVersion) return cachedDeploymentVersion;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    cachedDeploymentVersion = require('../package.json').version || 'unknown';
  } catch {
    cachedDeploymentVersion = 'unknown';
  }
  return cachedDeploymentVersion;
}

function pct(numerator, denominator) {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function slotUtilizationPercent(booked, capacity) {
  const b = Number(booked) || 0;
  const c = Number(capacity) || 0;
  if (c <= 0) return 0;
  return Math.round((b / c) * 1000) / 10;
}

function formatUtilization(booked, capacity) {
  const b = Number(booked) || 0;
  const c = Number(capacity) || 0;
  const percent = slotUtilizationPercent(b, c);
  return `${b} / ${c} (${percent}%)`;
}

const ACTION_LABELS = {
  OFFLINE_BOOKING_CREATED: 'Offline Booking Created',
  UPDATE_BOOKING_ATTENDANCE: 'Attendance Updated',
  TRAINER_ASSIGNED: 'Trainer Assigned',
  VEHICLE_CHANGED: 'Vehicle Changed',
  CUSTOMER_REACTIVATED: 'Customer Reactivated'
};

async function getTodayOperations() {
  const base = {
    todayBookings: 0,
    todayOnlineBookings: 0,
    todayOfflineBookings: 0,
    todayAttended: 0,
    todayPending: 0,
    todayNoShows: 0
  };

  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE b.status NOT IN ('cancelled'))::int AS today_bookings,
        COUNT(*) FILTER (
          WHERE b.status NOT IN ('cancelled') AND COALESCE(b.booking_source, 'ONLINE') = 'ONLINE'
        )::int AS today_online,
        COUNT(*) FILTER (
          WHERE b.status NOT IN ('cancelled') AND b.booking_source = 'OFFLINE'
        )::int AS today_offline,
        COUNT(*) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'ATTENDED'
        )::int AS today_attended,
        COUNT(*) FILTER (
          WHERE b.status IN ('pending', 'confirmed')
            AND COALESCE(b.attendance_status, 'SCHEDULED') = 'SCHEDULED'
        )::int AS today_pending,
        COUNT(*) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'NO_SHOW'
        )::int AS today_no_shows
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
    `);

    const row = result.rows[0] || {};
    return {
      todayBookings: Number(row.today_bookings) || 0,
      todayOnlineBookings: Number(row.today_online) || 0,
      todayOfflineBookings: Number(row.today_offline) || 0,
      todayAttended: Number(row.today_attended) || 0,
      todayPending: Number(row.today_pending) || 0,
      todayNoShows: Number(row.today_no_shows) || 0
    };
  } catch (error) {
    if (error.code === '42703') return base;
    throw error;
  }
}

async function getVehicleAnalytics() {
  try {
    const result = await db.query(`
      SELECT
        v.id AS vehicle_id,
        v.name AS vehicle_name,
        COUNT(b.id) FILTER (WHERE b.status NOT IN ('cancelled'))::int AS total_bookings,
        COUNT(b.id) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'ATTENDED'
        )::int AS attended,
        COUNT(b.id) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'NO_SHOW'
        )::int AS no_shows
      FROM vehicles v
      LEFT JOIN bookings b ON b.vehicle_id = v.id
      WHERE v.is_active = true
      GROUP BY v.id, v.name
      ORDER BY total_bookings DESC, v.name ASC
    `);

    const rows = result.rows.map((row) => {
      const attended = Number(row.attended) || 0;
      const noShows = Number(row.no_shows) || 0;
      const totalBookings = Number(row.total_bookings) || 0;
      const attendanceDenom = attended + noShows;
      return {
        vehicle_id: row.vehicle_id,
        vehicle_name: row.vehicle_name,
        total_bookings: totalBookings,
        attendance_percent: pct(attended, attendanceDenom),
        no_shows: noShows,
        usage_percent: 0
      };
    });

    const usageTotal = rows.reduce((sum, row) => sum + row.total_bookings, 0);
    for (const row of rows) {
      row.usage_percent = pct(row.total_bookings, usageTotal);
    }

    const withBookings = rows.filter((row) => row.total_bookings > 0);
    const topUsed = [...withBookings].sort((a, b) => b.total_bookings - a.total_bookings).slice(0, 5);
    const leastUsed = [...withBookings].sort((a, b) => a.total_bookings - b.total_bookings).slice(0, 5);

    return {
      vehicles: rows,
      charts: {
        topUsed: topUsed.map((row) => ({
          label: row.vehicle_name,
          value: row.total_bookings
        })),
        leastUsed: leastUsed.map((row) => ({
          label: row.vehicle_name,
          value: row.total_bookings
        }))
      }
    };
  } catch (error) {
    if (error.code === '42703') {
      return { vehicles: [], charts: { topUsed: [], leastUsed: [] } };
    }
    throw error;
  }
}

async function getTrainerAnalytics() {
  try {
    const result = await db.query(`
      SELECT
        t.id AS trainer_id,
        COALESCE(tp.full_name, 'Unnamed Trainer') AS trainer_name,
        COUNT(b.id)::int AS assigned_bookings,
        COUNT(b.id) FILTER (
          WHERE b.status = 'completed'
             OR COALESCE(b.attendance_status, 'SCHEDULED') = 'ATTENDED'
        )::int AS completed_sessions,
        COUNT(b.id) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'ATTENDED'
        )::int AS attended,
        COUNT(b.id) FILTER (
          WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'NO_SHOW'
        )::int AS no_shows
      FROM trainers t
      LEFT JOIN profiles tp ON t.user_id = tp.id
      LEFT JOIN bookings b ON b.trainer_id = t.id AND b.status NOT IN ('cancelled')
      WHERE t.is_active = true
      GROUP BY t.id, tp.full_name
      ORDER BY assigned_bookings DESC, trainer_name ASC
    `);

    const trainers = result.rows.map((row) => {
      const attended = Number(row.attended) || 0;
      const noShows = Number(row.no_shows) || 0;
      const attendanceDenom = attended + noShows;
      return {
        trainer_id: row.trainer_id,
        trainer_name: row.trainer_name,
        assigned_bookings: Number(row.assigned_bookings) || 0,
        completed_sessions: Number(row.completed_sessions) || 0,
        attendance_percent: pct(attended, attendanceDenom),
        no_show_percent: pct(noShows, attendanceDenom)
      };
    });

    const trendResult = await db.query(`
      SELECT
        to_char(date_trunc('month', b.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE b.trainer_id IS NOT NULL)::int AS assigned_count
      FROM bookings b
      WHERE b.created_at >= (NOW() - INTERVAL '6 months')
        AND b.status NOT IN ('cancelled')
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      trainers,
      charts: {
        workload: trainers
          .filter((row) => row.assigned_bookings > 0)
          .slice(0, 8)
          .map((row) => ({
            label: row.trainer_name,
            value: row.assigned_bookings
          })),
        assignmentTrend: trendResult.rows.map((row) => ({
          label: row.month,
          value: Number(row.assigned_count) || 0
        }))
      }
    };
  } catch (error) {
    if (error.code === '42703') {
      return { trainers: [], charts: { workload: [], assignmentTrend: [] } };
    }
    throw error;
  }
}

async function getRecentAdminActivity(limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

  try {
    const result = await db.query(
      `
      SELECT created_at, admin_name, action_type, action_label
      FROM (
        SELECT
          aal.created_at,
          COALESCE(p.full_name, 'Admin') AS admin_name,
          aal.action_type,
          aal.action_type AS action_label
        FROM admin_audit_log aal
        LEFT JOIN profiles p ON p.id = aal.admin_id
        WHERE aal.action_type IN ('OFFLINE_BOOKING_CREATED', 'UPDATE_BOOKING_ATTENDANCE')

        UNION ALL

        SELECT
          be.created_at,
          COALESCE(p.full_name, 'Admin') AS admin_name,
          be.event_type AS action_type,
          be.event_type AS action_label
        FROM booking_events be
        LEFT JOIN profiles p ON p.id = be.actor_id
        WHERE be.event_type IN ('TRAINER_ASSIGNED', 'VEHICLE_CHANGED')

        UNION ALL

        SELECT
          r.reviewed_at AS created_at,
          COALESCE(p.full_name, 'Admin') AS admin_name,
          'CUSTOMER_REACTIVATED' AS action_type,
          'CUSTOMER_REACTIVATED' AS action_label
        FROM account_reactivation_requests r
        LEFT JOIN profiles p ON p.id = r.reviewed_by
        WHERE r.status = 'approved' AND r.reviewed_at IS NOT NULL
      ) activity
      WHERE created_at IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [safeLimit]
    );

    return result.rows.map((row) => ({
      admin_name: row.admin_name,
      date: row.created_at,
      action: ACTION_LABELS[row.action_type] || row.action_label || row.action_type
    }));
  } catch (error) {
    if (error.code === '42P01' || error.code === '42703') {
      return [];
    }
    throw error;
  }
}

async function getSlotUtilizationSummary(limit = 8) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 20);

  try {
    const result = await db.query(
      `
      SELECT
        s.id,
        s.start_time,
        s.end_time,
        s.booked_count,
        s.capacity,
        s.capacity_exceeded,
        ${SLOT_DAY} AS slot_day
      FROM slots s
      WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
        AND s.capacity > 0
      ORDER BY ${SLOT_DAY} ASC, s.start_time ASC
      LIMIT 200
      `
    );

    const slots = result.rows
      .map((row) => {
        const booked = Number(row.booked_count) || 0;
        const capacity = Number(row.capacity) || 0;
        return {
          slot_id: row.id,
          slot_day: row.slot_day,
          start_time: row.start_time,
          end_time: row.end_time,
          booked_count: booked,
          capacity,
          utilization_percent: slotUtilizationPercent(booked, capacity),
          utilization_label: formatUtilization(booked, capacity),
          capacity_exceeded: row.capacity_exceeded === true
        };
      })
      .sort((a, b) => b.utilization_percent - a.utilization_percent)
      .slice(0, safeLimit);

    return slots;
  } catch (error) {
    if (error.code === '42703') {
      return [];
    }
    throw error;
  }
}

async function getSystemHealth() {
  const health = {
    activeVehicles: 0,
    activeTrainers: 0,
    futureSlots: 0,
    pendingReactivationRequests: 0,
    offlineBookingsToday: 0,
    capacityWarnings: 0,
    deploymentVersion: getDeploymentVersion()
  };

  try {
    const vehiclesResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM vehicles WHERE is_active = true`
    );
    health.activeVehicles = toCount(vehiclesResult.rows);

    const trainersResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM trainers WHERE is_active = true`
    );
    health.activeTrainers = toCount(trainersResult.rows);

    const futureSlotsResult = await db.query(`
      SELECT COUNT(*)::int AS count FROM slots s
      WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
    `);
    health.futureSlots = toCount(futureSlotsResult.rows);

    const offlineTodayResult = await db.query(`
      SELECT COUNT(*)::int AS count FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
        AND b.booking_source = 'OFFLINE'
        AND b.status NOT IN ('cancelled')
    `);
    health.offlineBookingsToday = toCount(offlineTodayResult.rows);

    try {
      const pendingReactivationResult = await db.query(
        `SELECT COUNT(*)::int AS count FROM account_reactivation_requests WHERE status = 'pending'`
      );
      health.pendingReactivationRequests = toCount(pendingReactivationResult.rows);
    } catch (reactErr) {
      if (reactErr.code !== '42P01') throw reactErr;
    }

    try {
      const capacityResult = await db.query(
        `SELECT COUNT(*)::int AS count FROM slots s WHERE capacity_exceeded = true AND ${SLOT_DAY} >= ${KOLKATA_TODAY}`
      );
      health.capacityWarnings = toCount(capacityResult.rows);
    } catch (capErr) {
      if (capErr.code !== '42703') throw capErr;
    }
  } catch (error) {
    console.error('[operationalAnalytics] system health failed:', error.message);
  }

  return health;
}

async function getOperationalDashboardData() {
  const [todayOperations, vehicleData, trainerData, recentAdminActivity, slotUtilization, systemHealth] =
    await Promise.all([
      getTodayOperations(),
      getVehicleAnalytics(),
      getTrainerAnalytics(),
      getRecentAdminActivity(15),
      getSlotUtilizationSummary(8),
      getSystemHealth()
    ]);

  return {
    todayOperations,
    vehicleAnalytics: vehicleData.vehicles,
    vehicleCharts: vehicleData.charts,
    trainerAnalytics: trainerData.trainers,
    trainerCharts: trainerData.charts,
    recentAdminActivity,
    slotUtilization,
    systemHealth
  };
}

module.exports = {
  getOperationalDashboardData,
  getTodayOperations,
  getVehicleAnalytics,
  getTrainerAnalytics,
  getRecentAdminActivity,
  getSlotUtilizationSummary,
  getSystemHealth,
  formatUtilization,
  slotUtilizationPercent
};
