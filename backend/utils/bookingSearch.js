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
  LEFT JOIN vehicles v ON b.vehicle_id = v.id`;

function buildBookingListQuery({ status, startDate, endDate, searchRaw, limit, offset }) {
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
      for (const token of nameTokens) {
        userParts.push(`COALESCE(u.full_name, '') ILIKE $${idx}`);
        trainerParts.push(`COALESCE(p.full_name, '') ILIKE $${idx}`);
        params.push(`%${token}%`);
        idx++;
      }
      parts.push(`((${userParts.join(' AND ')}) OR (${trainerParts.join(' AND ')}))`);
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

  if (startDate) {
    conditions.push(`${SLOT_DAY} >= $${idx++}::date`);
    params.push(String(startDate).trim());
  }

  if (endDate) {
    conditions.push(`${SLOT_DAY} <= $${idx++}::date`);
    params.push(String(endDate).trim());
  }

  const whereSql = conditions.join(' AND ');
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const countSql = `SELECT COUNT(*)::int AS total ${BOOKING_FROM} WHERE ${whereSql}`;
  const listSql = `
    SELECT b.*,
           s.start_time, s.end_time, s.slot_date,
           u.id AS user_id, u.full_name AS user_name, u.email AS user_email,
           t.id AS trainer_table_id,
           p.id AS trainer_profile_id, p.full_name AS trainer_name,
           v.name AS vehicle_name
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
    offset: safeOffset
  };
}

module.exports = {
  BOOKING_FROM,
  SLOT_DAY,
  buildBookingListQuery
};
