/**
 * Dashboard statistics — single source of truth for admin dashboard counts.
 * All slot-day filters use Asia/Kolkata calendar dates.
 */

const db = require('../db');
const overdueBookingService = require('./overdueBooking.service');
const { getOperationalDashboardData } = require('./operationalAnalytics.service');

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

function toCount(rows, field = 'count') {
  const raw = rows[0]?.[field];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const DEFAULT_STATS = {
  totalBookings: 0,
  activeSlots: 0,
  totalTrainers: 0,
  activeTrainers: 0,
  todaySessions: 0,
  pendingBookings: 0,
  completedToday: 0,
  totalUsers: 0,
  upcomingBookings: 0,
  todayBookings: 0,
  completedBookings: 0,
  cancelledBookings: 0,
  activeVehicles: 0,
  totalCustomers: 0,
  expiredBookings: 0,
  onlineBookings: 0,
  offlineBookings: 0,
  todayOnlineBookings: 0,
  todayOfflineBookings: 0,
  totalAttended: 0,
  totalNoShows: 0,
  attendanceRate: 0,
  capacityExceededSlots: 0,
  overdueBookings: [],
  todayOperations: {
    todayBookings: 0,
    todayOnlineBookings: 0,
    todayOfflineBookings: 0,
    todayAttended: 0,
    todayPending: 0,
    todayNoShows: 0
  },
  systemHealth: {
    activeVehicles: 0,
    activeTrainers: 0,
    futureSlots: 0,
    pendingReactivationRequests: 0,
    offlineBookingsToday: 0,
    capacityWarnings: 0,
    deploymentVersion: 'unknown'
  },
  vehicleAnalytics: [],
  vehicleCharts: { topUsed: [], leastUsed: [] },
  trainerAnalytics: [],
  trainerCharts: { workload: [], assignmentTrend: [] },
  recentAdminActivity: [],
  slotUtilization: []
};

async function getDashboardStats() {
  const stats = { ...DEFAULT_STATS };

  const totalBookingsResult = await db.query('SELECT COUNT(*)::int AS count FROM bookings');
  stats.totalBookings = toCount(totalBookingsResult.rows);

  const onlineBookingsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE COALESCE(booking_source, 'ONLINE') = 'ONLINE'`
  );
  stats.onlineBookings = toCount(onlineBookingsResult.rows);

  const offlineBookingsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE booking_source = 'OFFLINE'`
  );
  stats.offlineBookings = toCount(offlineBookingsResult.rows);

  const activeSlotsResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM slots s
    LEFT JOIN trainers t ON s.trainer_id = t.id
    WHERE s.status = 'available'
      AND s.booked_count < s.capacity
      AND (t.is_active = true OR s.trainer_id IS NULL)
      AND (${SLOT_DAY} >= ${KOLKATA_TODAY})
  `);
  stats.activeSlots = toCount(activeSlotsResult.rows);

  const activeTrainersResult = await db.query(
    'SELECT COUNT(*)::int AS count FROM trainers WHERE is_active = true'
  );
  stats.totalTrainers = toCount(activeTrainersResult.rows);
  stats.activeTrainers = stats.totalTrainers;

  const todaySessionsResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
      AND b.status = 'confirmed'
  `);
  stats.todaySessions = toCount(todaySessionsResult.rows);

  const pendingBookingsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'pending'`
  );
  stats.pendingBookings = toCount(pendingBookingsResult.rows);

  const completedTodayResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
      AND b.status = 'completed'
  `);
  stats.completedToday = toCount(completedTodayResult.rows);

  const totalUsersResult = await db.query('SELECT COUNT(*)::int AS count FROM profiles');
  stats.totalUsers = toCount(totalUsersResult.rows);

  const upcomingBookingsResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE s.start_time > NOW() AND b.status = 'confirmed'
  `);
  stats.upcomingBookings = toCount(upcomingBookingsResult.rows);

  const todayBookingsResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
      AND b.status NOT IN ('cancelled')
  `);
  stats.todayBookings = toCount(todayBookingsResult.rows);

  const todayOnlineResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
      AND COALESCE(b.booking_source, 'ONLINE') = 'ONLINE'
      AND b.status NOT IN ('cancelled')
  `);
  stats.todayOnlineBookings = toCount(todayOnlineResult.rows);

  const todayOfflineResult = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
      AND b.booking_source = 'OFFLINE'
      AND b.status NOT IN ('cancelled')
  `);
  stats.todayOfflineBookings = toCount(todayOfflineResult.rows);

  try {
    const attendedResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM bookings WHERE attendance_status = 'ATTENDED'`
    );
    stats.totalAttended = toCount(attendedResult.rows);

    const noShowResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM bookings WHERE attendance_status = 'NO_SHOW'`
    );
    stats.totalNoShows = toCount(noShowResult.rows);

    const denom = stats.totalAttended + stats.totalNoShows;
    stats.attendanceRate = denom > 0 ? Math.round((stats.totalAttended / denom) * 1000) / 10 : 0;
  } catch (attErr) {
    if (attErr.code !== '42703') throw attErr;
  }

  try {
    const exceededResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM slots s WHERE capacity_exceeded = true AND ${SLOT_DAY} >= ${KOLKATA_TODAY}`
    );
    stats.capacityExceededSlots = toCount(exceededResult.rows);
  } catch (capErr) {
    if (capErr.code !== '42703') throw capErr;
  }

  const completedBookingsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'completed'`
  );
  stats.completedBookings = toCount(completedBookingsResult.rows);

  const cancelledBookingsResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'cancelled'`
  );
  stats.cancelledBookings = toCount(cancelledBookingsResult.rows);

  const activeVehiclesResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM vehicles WHERE is_active = true`
  );
  stats.activeVehicles = toCount(activeVehiclesResult.rows);

  const totalCustomersResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM profiles WHERE role = 'customer'`
  );
  stats.totalCustomers = toCount(totalCustomersResult.rows);

  stats.expiredBookings = toCount(
    [{ count: await overdueBookingService.countOverdueBookings() }]
  );
  const overdueList = await overdueBookingService.listOverdueBookings(8);
  stats.overdueBookings = Array.isArray(overdueList) ? overdueList : [];

  try {
    const operational = await getOperationalDashboardData();
    Object.assign(stats, operational);
  } catch (operationalErr) {
    console.error('[dashboardStats] operational analytics failed:', operationalErr.message);
  }

  return stats;
}

module.exports = {
  getDashboardStats,
  DEFAULT_STATS,
  KOLKATA_TODAY,
  SLOT_DAY,
  toCount
};
