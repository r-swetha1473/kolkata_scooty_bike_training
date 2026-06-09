/**
 * Cross-check dashboard stats API logic vs direct SQL counts.
 * Usage: cd backend && node scripts/dashboard_validation.js
 */
require('dotenv').config();
const db = require('../db');
const { getDashboardStats, SLOT_DAY, KOLKATA_TODAY } = require('../services/dashboardStats.service');

const CHECKS = [
  {
    key: 'totalCustomers',
    label: 'Total Customers',
    sql: `SELECT COUNT(*)::int AS count FROM profiles WHERE role = 'customer'`
  },
  {
    key: 'totalCustomers_all',
    label: 'Total Customers (all, legacy)',
    sql: `SELECT COUNT(*)::int AS count FROM profiles WHERE role = 'customer'`
  },
  {
    key: 'activeTrainers',
    sql: `SELECT COUNT(*)::int AS count FROM trainers WHERE is_active = true`
  },
  {
    key: 'activeVehicles',
    sql: `SELECT COUNT(*)::int AS count FROM vehicles WHERE is_active = true`
  },
  {
    key: 'todayBookings',
    sql: `SELECT COUNT(*)::int AS count FROM bookings b
          JOIN slots s ON b.slot_id = s.id
          WHERE ${SLOT_DAY} = ${KOLKATA_TODAY}
            AND b.status NOT IN ('cancelled')`
  },
  {
    key: 'todayBookings_utc',
    label: "Today's Bookings (UTC CURRENT_DATE — old bug)",
    sql: `SELECT COUNT(*)::int AS count FROM bookings b
          JOIN slots s ON b.slot_id = s.id
          WHERE (s.slot_date = CURRENT_DATE OR s.start_time::date = CURRENT_DATE)
            AND b.status NOT IN ('cancelled')`
  },
  {
    key: 'pendingBookings',
    sql: `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'pending'`
  },
  {
    key: 'completedBookings',
    sql: `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'completed'`
  },
  {
    key: 'cancelledBookings',
    sql: `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'cancelled'`
  },
  {
    key: 'expiredBookings',
    sql: `SELECT COUNT(*)::int AS count FROM bookings b
          JOIN slots s ON b.slot_id = s.id
          WHERE b.status IN ('pending', 'confirmed') AND s.end_time < NOW()`
  }
];

async function getApiStats() {
  return getDashboardStats();
}

async function main() {
  console.log('Dashboard Validation Report\n');
  const apiStats = await getApiStats();

  for (const c of CHECKS) {
    const r = await db.query(c.sql);
    const dbCount = r.rows[0]?.count ?? 0;
    const apiKey = c.key.replace('_utc', '').replace('_all', '');
    const apiCount = apiStats[apiKey];
    const match =
      apiCount === undefined
        ? 'n/a'
        : dbCount === apiCount
          ? 'MATCH'
          : `MISMATCH (api=${apiCount})`;
    console.log(`${c.label || c.key}: db=${dbCount} ${match}`);
    if (c.label) console.log(`  SQL: ${c.sql.replace(/\s+/g, ' ').trim()}`);
  }

  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
