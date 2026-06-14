/**
 * Read-only customer booking history for admin booking detail panel.
 */

const db = require('../db');

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

const DEFAULT_HISTORY = {
  total_bookings: 0,
  attended_sessions: 0,
  no_shows: 0,
  cancelled_bookings: 0,
  last_booking_date: null,
  next_booking_date: null
};

function normalizePhoneDigits(value) {
  if (value == null || value === '') return '';
  return String(value).replace(/\D/g, '');
}

function buildMatchClause({ userId, phone, offlineCustomerName }) {
  const parts = [];
  const params = [];
  let idx = 1;

  if (userId) {
    parts.push(`b.user_id = $${idx++}`);
    params.push(userId);
  }

  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits.length >= 6) {
    parts.push(
      `(regexp_replace(COALESCE(b.phone::text, ''), '\\D', '', 'g') = $${idx}
        OR EXISTS (
          SELECT 1 FROM profiles pu
          WHERE pu.id = b.user_id
            AND regexp_replace(COALESCE(pu.phone::text, ''), '\\D', '', 'g') = $${idx}
        ))`
    );
    params.push(phoneDigits);
    idx += 1;
  }

  const offlineName = offlineCustomerName ? String(offlineCustomerName).trim() : '';
  if (offlineName.length >= 2) {
    parts.push(`LOWER(TRIM(b.offline_customer_name)) = LOWER(TRIM($${idx++}))`);
    params.push(offlineName);
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    whereSql: `(${parts.join(' OR ')})`,
    params
  };
}

async function getCustomerHistory({ userId, phone, offlineCustomerName }) {
  const match = buildMatchClause({ userId, phone, offlineCustomerName });
  if (!match) {
    return { ...DEFAULT_HISTORY };
  }

  try {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE b.status NOT IN ('cancelled'))::int AS total_bookings,
         COUNT(*) FILTER (WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'ATTENDED')::int AS attended_sessions,
         COUNT(*) FILTER (WHERE COALESCE(b.attendance_status, 'SCHEDULED') = 'NO_SHOW')::int AS no_shows,
         COUNT(*) FILTER (
           WHERE b.status = 'cancelled'
              OR COALESCE(b.attendance_status, 'SCHEDULED') = 'CANCELLED'
         )::int AS cancelled_bookings,
         MAX(${SLOT_DAY}) FILTER (
           WHERE ${SLOT_DAY} < ${KOLKATA_TODAY}
             AND b.status NOT IN ('cancelled')
         ) AS last_booking_date,
         MIN(${SLOT_DAY}) FILTER (
           WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
             AND b.status NOT IN ('cancelled', 'completed')
         ) AS next_booking_date
       FROM bookings b
       LEFT JOIN slots s ON b.slot_id = s.id
       WHERE ${match.whereSql}`,
      match.params
    );

    const row = result.rows[0] || {};
    return {
      total_bookings: Number(row.total_bookings) || 0,
      attended_sessions: Number(row.attended_sessions) || 0,
      no_shows: Number(row.no_shows) || 0,
      cancelled_bookings: Number(row.cancelled_bookings) || 0,
      last_booking_date: row.last_booking_date || null,
      next_booking_date: row.next_booking_date || null
    };
  } catch (error) {
    if (error.code === '42703') {
      return { ...DEFAULT_HISTORY };
    }
    throw error;
  }
}

module.exports = {
  getCustomerHistory,
  DEFAULT_HISTORY
};
