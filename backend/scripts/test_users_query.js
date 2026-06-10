require('dotenv').config();
const db = require('../db');

const query = `
  SELECT 
    p.id, 
    p.email, 
    p.full_name, 
    p.phone, 
    p.google_id,
    p.role, 
    p.created_at,
    p.total_bookings,
    p.last_booking_date,
    p.weekly_booking_count,
    p.weekly_reset_date,
    p.inactive_blocked,
    COUNT(b.id) FILTER (WHERE b.status NOT IN ('cancelled')) as active_bookings
  FROM profiles p
  LEFT JOIN bookings b ON p.id = b.user_id
  GROUP BY p.id, p.email, p.full_name, p.phone, p.google_id, p.role, p.created_at, 
           p.total_bookings, p.last_booking_date, p.weekly_booking_count, p.weekly_reset_date,
           p.inactive_blocked
  ORDER BY p.created_at DESC
  LIMIT 5
`;

db.query(query)
  .then((r) => {
    console.log('rows', r.rows.length);
    console.log(JSON.stringify(r.rows[0], null, 2));
    return db.pool.end();
  })
  .catch((e) => {
    console.error('QUERY_ERROR', e.message);
    return db.pool.end().then(() => process.exit(1));
  });
