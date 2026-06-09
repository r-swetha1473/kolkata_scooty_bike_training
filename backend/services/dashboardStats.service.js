/**
 * Dashboard statistics — single source of truth for admin dashboard counts.
 * All slot-day filters use Asia/Kolkata calendar dates.
 */

const db = require('../db');
const overdueBookingService = require('./overdueBooking.service');

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

function toCount(rows, field = 'count') {
  const raw = rows[0]?.[field];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function getDashboardStats() {
  const stats = {};

  const totalBookingsResult = await db.query('SELECT COUNT(*)::int AS count FROM bookings');
  stats.totalBookings = toCount(totalBookingsResult.rows);

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

  stats.expiredBookings = await overdueBookingService.countOverdueBookings();
  stats.overdueBookings = await overdueBookingService.listOverdueBookings(8);

  return stats;
}

module.exports = {
  getDashboardStats,
  KOLKATA_TODAY,
  SLOT_DAY,
  toCount
};
