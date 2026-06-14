/**
 * Verify schema dependencies and SQL probes for admin dashboard APIs.
 * Usage: cd backend && node scripts/verify_dashboard_schema.js
 */
require('dotenv').config();
const db = require('../db');
const { parseDatabaseTarget } = require('../services/offlineBookingSchema.service');
const { SLOT_DAY, KOLKATA_TODAY } = require('../services/dashboardStats.service');

const MIGRATION_HINTS = {
  booking_source: '20260614120000_offline_bookings_and_live_capacity.sql',
  booking_source_enum: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_customer_name: '20260614120000_offline_bookings_and_live_capacity.sql',
  offline_reference_number: '20260615120000_phase2_offline_enhancements.sql',
  attendance_status: '20260615120000_phase2_offline_enhancements.sql',
  attendance_status_enum: '20260615120000_phase2_offline_enhancements.sql',
  updated_by_admin_id: '20260615120000_phase2_offline_enhancements.sql',
  attendance_updated_by: '20260615120000_phase2_offline_enhancements.sql',
  vehicle_type: '20260120000000_phase2_vehicle_based_bookings.sql',
  vehicle_type_enum: '20260120000000_phase2_vehicle_based_bookings.sql',
  capacity_exceeded: '20260615120000_phase2_offline_enhancements.sql',
  admin_audit_log: '20260121000000_phase4_admin_audit_log.sql',
  booking_events: '20260615120000_phase2_offline_enhancements.sql',
  account_reactivation_requests: '20260612120000_account_reactivation_requests.sql',
  slot_vehicle_capacity: '20260124000000_create_slot_vehicle_capacity.sql'
};

const BOOKINGS_COLUMNS = [
  'booking_source',
  'attendance_status',
  'offline_customer_name',
  'offline_reference_number',
  'created_by_admin_id',
  'updated_by_admin_id',
  'attendance_updated_by',
  'vehicle_type'
];

const SLOTS_COLUMNS = ['capacity_exceeded', 'slot_date', 'booked_count', 'capacity'];

const ENUMS = ['booking_source_enum', 'attendance_status_enum', 'vehicle_type_enum'];

const TABLES = [
  'bookings',
  'slots',
  'profiles',
  'trainers',
  'vehicles',
  'admin_audit_log',
  'booking_events',
  'account_reactivation_requests',
  'slot_vehicle_capacity'
];

const QUERY_PROBES = [
  {
    name: 'dashboardStats.capacityExceededSlots',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT COUNT(*)::int AS count FROM slots s WHERE capacity_exceeded = true AND ${SLOT_DAY} >= ${KOLKATA_TODAY}`
  },
  {
    name: 'dashboardStats.bookingSourceCounts',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT COUNT(*)::int AS count FROM bookings WHERE booking_source = 'OFFLINE'`
  },
  {
    name: 'dashboardStats.attendanceCounts',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT COUNT(*)::int AS count FROM bookings WHERE attendance_status = 'ATTENDED'`
  },
  {
    name: 'operationalAnalytics.recentAdminActivity',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT 1 FROM admin_audit_log LIMIT 0`
  },
  {
    name: 'operationalAnalytics.bookingEvents',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT 1 FROM booking_events LIMIT 0`
  },
  {
    name: 'operationalAnalytics.slotUtilization',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT s.id, s.capacity_exceeded, ${SLOT_DAY} AS slot_day FROM slots s WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY} LIMIT 1`
  },
  {
    name: 'operationalAnalytics.systemHealth.capacityWarnings',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT COUNT(*)::int AS count FROM slots s WHERE capacity_exceeded = true AND ${SLOT_DAY} >= ${KOLKATA_TODAY}`
  },
  {
    name: 'overdueBooking.listOverdue',
    endpoint: 'GET /api/admin/stats',
    sql: `SELECT b.id, COALESCE(b.offline_customer_name, u.full_name) AS customer_name
          FROM bookings b JOIN slots s ON b.slot_id = s.id
          LEFT JOIN profiles u ON b.user_id = u.id
          WHERE b.status IN ('pending','confirmed') AND s.end_time < NOW() LIMIT 1`
  },
  {
    name: 'adminBookings.list',
    endpoint: 'GET /api/admin/bookings',
    sql: `SELECT b.booking_source, b.attendance_status, s.capacity_exceeded
          FROM bookings b
          LEFT JOIN slots s ON b.slot_id = s.id
          LIMIT 1`
  }
];

function mark(ok) {
  return ok ? '✓' : '✗';
}

async function columnExists(table, column) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function tableExists(table) {
  const r = await db.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
  return !!r.rows[0]?.reg;
}

async function enumExists(name) {
  const r = await db.query('SELECT 1 FROM pg_type WHERE typname = $1', [name]);
  return r.rows.length > 0;
}

async function main() {
  console.log('Dashboard Schema Verification\n');
  console.log('Database target:', parseDatabaseTarget());
  console.log('');

  const failures = [];

  console.log('=== TABLES ===');
  for (const table of TABLES) {
    const ok = await tableExists(table);
    console.log(`  ${mark(ok)} ${table}${ok ? '' : `  → ${MIGRATION_HINTS[table] || 'check supabase/migrations/'}`}`);
    if (!ok) failures.push({ kind: 'table', name: table, migration: MIGRATION_HINTS[table] });
  }

  console.log('\n=== BOOKINGS COLUMNS ===');
  for (const col of BOOKINGS_COLUMNS) {
    const ok = await columnExists('bookings', col);
    console.log(`  ${mark(ok)} ${col}${ok ? '' : `  → ${MIGRATION_HINTS[col]}`}`);
    if (!ok) failures.push({ kind: 'column', name: `bookings.${col}`, migration: MIGRATION_HINTS[col] });
  }

  console.log('\n=== SLOTS COLUMNS ===');
  for (const col of SLOTS_COLUMNS) {
    const ok = await columnExists('slots', col);
    console.log(`  ${mark(ok)} slots.${col}${ok ? '' : `  → ${MIGRATION_HINTS[col] || '20260407120000_production_schema_safety_net.sql'}`}`);
    if (!ok) failures.push({ kind: 'column', name: `slots.${col}`, migration: MIGRATION_HINTS[col] });
  }

  console.log('\n=== ENUM TYPES ===');
  for (const en of ENUMS) {
    const ok = await enumExists(en);
    console.log(`  ${mark(ok)} ${en}${ok ? '' : `  → ${MIGRATION_HINTS[en]}`}`);
    if (!ok) failures.push({ kind: 'enum', name: en, migration: MIGRATION_HINTS[en] });
  }

  console.log('\n=== DASHBOARD SQL PROBES ===');
  for (const probe of QUERY_PROBES) {
    try {
      await db.query(probe.sql);
      console.log(`  ${mark(true)} ${probe.name}`);
    } catch (error) {
      console.log(`  ${mark(false)} ${probe.name}`);
      console.log(`      endpoint: ${probe.endpoint}`);
      console.log(`      pgCode: ${error.code}`);
      console.log(`      message: ${error.message}`);
      failures.push({
        kind: 'query',
        name: probe.name,
        endpoint: probe.endpoint,
        pgCode: error.code,
        message: error.message
      });
    }
  }

  console.log('\n=== FULL DASHBOARD STATS SERVICE ===');
  try {
    const { getDashboardStats } = require('../services/dashboardStats.service');
    await getDashboardStats();
    console.log('  ✓ getDashboardStats()');
  } catch (error) {
    console.log('  ✗ getDashboardStats()');
    console.log(`      pgCode: ${error.code}`);
    console.log(`      message: ${error.message}`);
    console.log(`      queryName: ${error.dashboardQueryName || '(unknown)'}`);
    failures.push({
      kind: 'service',
      name: 'getDashboardStats',
      endpoint: 'GET /api/admin/stats',
      pgCode: error.code,
      message: error.message
    });
  }

  console.log('\n=== RESULT ===');
  if (failures.length === 0) {
    console.log('PASS — dashboard schema and SQL probes ready');
  } else {
    console.log(`FAIL — ${failures.length} issue(s)`);
    for (const f of failures) {
      if (f.migration) {
        console.log(`  - ${f.name}: apply ${f.migration}`);
      } else {
        console.log(`  - ${f.name}: ${f.message}`);
      }
    }
  }

  await db.pool.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL:', e.message);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
