/**
 * Verify offline booking schema prerequisites on the connected DATABASE_URL.
 * Usage: cd backend && node scripts/verify_offline_booking_schema.js
 */
require('dotenv').config();
const {
  auditOfflineBookingSchema,
  parseDatabaseTarget
} = require('../services/offlineBookingSchema.service');
const db = require('../db');

function printSection(title, items, formatter) {
  if (!items.length) {
    console.log(`  (none missing)`);
    return;
  }
  for (const item of items) {
    console.log(`  ${formatter(item)}`);
  }
}

async function main() {
  const target = parseDatabaseTarget();
  console.log('Offline Booking Schema Verification\n');
  console.log('Database target:', target);
  console.log('');

  const report = await auditOfflineBookingSchema();

  console.log('=== BOOKINGS COLUMNS ===');
  const colMissing = new Set(report.missing.columns.map((c) => c.name));
  for (const col of [
    'booking_source',
    'created_by_admin_id',
    'offline_customer_name',
    'offline_customer_age',
    'offline_customer_gender',
    'offline_reference_number',
    'attendance_status'
  ]) {
    console.log(`  ${colMissing.has(col) ? 'MISSING' : 'OK     '}  ${col}`);
  }

  console.log('\n=== ENUM TYPES ===');
  const enumMissing = new Set(report.missing.enums.map((e) => e.name));
  for (const en of ['booking_source_enum', 'attendance_status_enum']) {
    console.log(`  ${enumMissing.has(en) ? 'MISSING' : 'OK     '}  ${en}`);
  }

  console.log('\n=== TABLES ===');
  const tableMissing = new Set(report.missing.tables.map((t) => t.name));
  for (const t of ['booking_events', 'account_reactivation_requests']) {
    console.log(`  ${tableMissing.has(t) ? 'MISSING' : 'OK     '}  ${t}`);
  }

  console.log('\n=== FUNCTIONS ===');
  const fnMissing = new Set(report.missing.functions.map((f) => f.name));
  for (const fn of [
    'generate_offline_reference_number',
    'prune_inactive_slot_vehicle_capacities',
    'set_booking_vehicle_type_from_vehicle'
  ]) {
    console.log(`  ${fnMissing.has(fn) ? 'MISSING' : 'OK     '}  ${fn}()`);
  }

  console.log('\n=== SEQUENCE ===');
  console.log(
    `  ${report.missing.sequences.length ? 'MISSING' : 'OK     '}  offline_booking_reference_seq`
  );

  console.log('\n=== INDEXES ===');
  const idxMissing = new Set(report.missing.indexes.map((i) => i.name));
  for (const idx of [
    'idx_bookings_booking_source',
    'idx_bookings_created_by_admin_id',
    'idx_bookings_offline_reference_number',
    'idx_bookings_attendance_status'
  ]) {
    console.log(`  ${idxMissing.has(idx) ? 'MISSING' : 'OK     '}  ${idx}`);
  }

  console.log('\n=== CONSTRAINTS ===');
  console.log(
    `  ${report.missing.constraints.length ? 'MISSING' : 'OK     '}  bookings_source_identity_check`
  );

  console.log('\n=== PREREQUISITE CHECKS ===');
  printSection('', report.missing.prerequisites, (p) => `MISSING  ${p.check}: ${p.error}`);

  if (report.requiredMigrations.length) {
    console.log('\n=== REQUIRED MIGRATIONS ===');
    for (const m of report.requiredMigrations) {
      console.log(`  - supabase/migrations/${m}`);
    }
    console.log('\nApply in order:');
    console.log('  node apply_migration.js ../supabase/migrations/20260614120000_offline_bookings_and_live_capacity.sql --skip-admin');
    console.log('  node apply_migration.js ../supabase/migrations/20260615120000_phase2_offline_enhancements.sql --skip-admin');
    console.log('  node apply_migration.js ../supabase/migrations/20260407120000_production_schema_safety_net.sql --skip-admin');
  }

  console.log(`\nResult: ${report.ok ? 'PASS — offline booking schema ready' : 'FAIL — apply migrations above'}`);
  await db.pool.end();
  process.exit(report.ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error('FATAL:', err.message);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
