/**
 * Admin user list query builder — shared by GET /admin/users.
 */

const LATEST_BOOKING_PHONE_SQL = `
  (
    SELECT TRIM(b.phone::text)
    FROM bookings b
    WHERE b.user_id = p.id
      AND b.phone IS NOT NULL
      AND TRIM(b.phone::text) <> ''
      AND LEFT(UPPER(TRIM(b.phone::text)), 7) <> 'GOOGLE_'
    ORDER BY b.created_at DESC
    LIMIT 1
  )`;

function buildAdminUsersListQuery({ role, search, limit, offset }) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (role) {
    conditions.push(`p.role = $${idx++}`);
    params.push(String(role).trim());
  }

  if (search) {
    const term = `%${String(search).trim()}%`;
    conditions.push(`(
      COALESCE(p.full_name, '') ILIKE $${idx} OR
      COALESCE(p.email, '') ILIKE $${idx} OR
      (
        p.phone IS NOT NULL
        AND TRIM(p.phone::text) <> ''
        AND LEFT(UPPER(TRIM(p.phone::text)), 7) <> 'GOOGLE_'
        AND TRIM(p.phone::text) ILIKE $${idx}
      ) OR
      EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.user_id = p.id
          AND b.phone IS NOT NULL
          AND TRIM(b.phone::text) <> ''
          AND LEFT(UPPER(TRIM(b.phone::text)), 7) <> 'GOOGLE_'
          AND TRIM(b.phone::text) ILIKE $${idx}
      )
    )`);
    params.push(term);
    idx++;
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*)::int AS total FROM profiles p ${whereSql}`;

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 0, 0), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let listSql = `
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.phone AS profile_phone,
      ${LATEST_BOOKING_PHONE_SQL} AS latest_booking_phone,
      p.google_id,
      p.role,
      p.created_at,
      COALESCE(p.total_bookings, 0) AS total_bookings,
      p.last_booking_date,
      COALESCE(p.weekly_booking_count, 0) AS weekly_booking_count,
      p.weekly_reset_date,
      COALESCE(p.inactive_blocked, false) AS inactive_blocked,
      (
        SELECT COUNT(*)::int
        FROM bookings b
        WHERE b.user_id = p.id AND b.status NOT IN ('cancelled')
      ) AS active_bookings
    FROM profiles p
    ${whereSql}
    ORDER BY p.created_at DESC
  `;

  const listParams = [...params];
  if (safeLimit > 0) {
    listSql += ` LIMIT $${idx} OFFSET $${idx + 1}`;
    listParams.push(safeLimit, safeOffset);
  }

  return {
    countSql,
    countParams: params,
    listSql,
    listParams,
    limit: safeLimit,
    offset: safeOffset,
    latestBookingPhoneSql: LATEST_BOOKING_PHONE_SQL
  };
}

module.exports = { buildAdminUsersListQuery, LATEST_BOOKING_PHONE_SQL };
