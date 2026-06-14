/**
 * Bookings whose slot end time has passed but status is still pending/confirmed.
 */

const db = require('../db');

const OVERDUE_STATUS_SQL = `b.status IN ('pending', 'confirmed')`;
const OVERDUE_TIME_SQL = `s.end_time < NOW()`;

const OVERDUE_SELECT = `
  SELECT b.id, b.status, b.created_at,
         s.start_time, s.end_time, s.slot_date,
         COALESCE(b.offline_customer_name, u.full_name) AS customer_name, u.email AS customer_email,
         p.full_name AS trainer_name
  FROM bookings b
  JOIN slots s ON b.slot_id = s.id
  LEFT JOIN profiles u ON b.user_id = u.id
  LEFT JOIN trainers t ON b.trainer_id = t.id
  LEFT JOIN profiles p ON t.user_id = p.id
  WHERE ${OVERDUE_STATUS_SQL} AND ${OVERDUE_TIME_SQL}
`;

async function countOverdueBookings() {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM bookings b
     JOIN slots s ON b.slot_id = s.id
     WHERE ${OVERDUE_STATUS_SQL} AND ${OVERDUE_TIME_SQL}`
  );
  return parseInt(result.rows[0]?.count || 0, 10);
}

async function listOverdueBookings(limit = 20) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const result = await db.query(
    `${OVERDUE_SELECT}
     ORDER BY s.end_time DESC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows;
}

module.exports = {
  countOverdueBookings,
  listOverdueBookings
};
