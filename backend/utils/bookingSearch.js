/**
 * Shared admin booking list search/filter SQL builder.
 */

const SLOT_DAY = `COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

const BOOKING_FROM = `
  FROM bookings b
  LEFT JOIN slots s ON b.slot_id = s.id
  LEFT JOIN profiles u ON b.user_id = u.id
  LEFT JOIN trainers t ON b.trainer_id = t.id
  LEFT JOIN profiles p ON t.user_id = p.id
  LEFT JOIN vehicles v ON b.vehicle_id = v.id
  LEFT JOIN profiles creator ON b.created_by_admin_id = creator.id
  LEFT JOIN profiles updater ON b.updated_by_admin_id = updater.id
  LEFT JOIN profiles attendance_updater ON b.attendance_updated_by = attendance_updater.id`;

const ATTENDANCE_VALUES = ['SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED'];

function buildBookingListQuery({
  status,
  source,
  attendance,
  startDate,
  endDate,
  searchRaw,
  limit,
  offset
}) {
  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (searchRaw) {
    const term = String(searchRaw).trim();
    const q = `%${term}%`;
    const digits = term.replace(/\D/g, '');
    const parts = [
      `COALESCE(u.full_name, '') ILIKE $${idx}`,
      `COALESCE(u.email, '') ILIKE $${idx}`,
      `COALESCE(u.phone::text, '') ILIKE $${idx}`,
      `COALESCE(b.phone::text, '') ILIKE $${idx}`,
      `COALESCE(b.offline_customer_name, '') ILIKE $${idx}`,
      `COALESCE(b.offline_reference_number, '') ILIKE $${idx}`,
      `COALESCE(p.full_name, '') ILIKE $${idx}`,
      `COALESCE(v.name, '') ILIKE $${idx}`,
      `COALESCE(b.notes, '') ILIKE $${idx}`,
      `b.id::text ILIKE $${idx}`
    ];
    params.push(q);
    idx++;

    const nameTokens = term.split(/\s+/).filter((t) => t.length >= 2);
    if (nameTokens.length > 1) {
      const userParts = [];
      const trainerParts = [];
      const offlineParts = [];
      for (const token of nameTokens) {
        userParts.push(`COALESCE(u.full_name, '') ILIKE $${idx}`);
        trainerParts.push(`COALESCE(p.full_name, '') ILIKE $${idx}`);
        offlineParts.push(`COALESCE(b.offline_customer_name, '') ILIKE $${idx}`);
        params.push(`%${token}%`);
        idx++;
      }
      parts.push(`((${userParts.join(' AND ')}) OR (${trainerParts.join(' AND ')}) OR (${offlineParts.join(' AND ')}))`);
    }

    if (digits.length >= 3) {
      parts.push(`regexp_replace(COALESCE(u.phone::text, ''), '\\D', '', 'g') LIKE $${idx}`);
      parts.push(`regexp_replace(COALESCE(b.phone::text, ''), '\\D', '', 'g') LIKE $${idx + 1}`);
      params.push(`%${digits}%`);
      params.push(`%${digits}%`);
      idx += 2;
    }

    conditions.push(`(${parts.join(' OR ')})`);
  }

  if (status) {
    conditions.push(`b.status = $${idx++}`);
    params.push(String(status).trim());
  }

  if (source === 'ONLINE' || source === 'OFFLINE') {
    conditions.push(`b.booking_source = $${idx++}`);
    params.push(source);
  }

  const attendanceUpper = attendance ? String(attendance).trim().toUpperCase() : '';
  if (ATTENDANCE_VALUES.includes(attendanceUpper)) {
    conditions.push(`COALESCE(b.attendance_status, 'SCHEDULED') = $${idx++}::attendance_status_enum`);
    params.push(attendanceUpper);
  }

  if (startDate) {
    conditions.push(`${SLOT_DAY} >= $${idx++}::date`);
    params.push(String(startDate).trim());
  }

  if (endDate) {
    conditions.push(`${SLOT_DAY} <= $${idx++}::date`);
    params.push(String(endDate).trim());
  }

  const whereSql = conditions.join(' AND ');
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const countSql = `SELECT COUNT(*)::int AS total ${BOOKING_FROM} WHERE ${whereSql}`;
  const listSql = `
    SELECT b.*,
           s.start_time, s.end_time, s.slot_date, s.capacity_exceeded,
           u.id AS user_id, u.full_name AS user_name, u.email AS user_email,
           t.id AS trainer_table_id,
           p.id AS trainer_profile_id, p.full_name AS trainer_name,
           v.name AS vehicle_name,
           creator.full_name AS created_by_admin_name,
           creator.role AS created_by_admin_role,
           updater.full_name AS updated_by_admin_name,
           updater.role AS updated_by_admin_role,
           attendance_updater.full_name AS attendance_updated_by_name,
           attendance_updater.role AS attendance_updated_by_role
    ${BOOKING_FROM}
    WHERE ${whereSql}
    ORDER BY s.start_time DESC NULLS LAST, b.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}`;

  const listParams = [...params, safeLimit, safeOffset];

  return {
    countSql,
    listSql,
    countParams: params,
    listParams,
    limit: safeLimit,
    offset: safeOffset,
    whereSql,
    params
  };
}

function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

module.exports = {
  BOOKING_FROM,
  SLOT_DAY,
  ATTENDANCE_VALUES,
  buildBookingListQuery,
  rowsToCsv
};
