/**
 * Post-migration verification for vehicle_type schema objects.
 */
require('dotenv').config();
const db = require('../db');
const { parseDatabaseTarget } = require('../services/offlineBookingSchema.service');

async function main() {
  console.log('Target:', parseDatabaseTarget());

  const enumRes = await db.query(
    `SELECT typname, enumlabel FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE typname = 'vehicle_type_enum'
     ORDER BY enumsortorder`
  );
  console.log('\nvehicle_type_enum:', enumRes.rows.length ? enumRes.rows.map((r) => r.enumlabel).join(', ') : 'MISSING');

  const colRes = await db.query(
    `SELECT column_name, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'vehicle_type'`
  );
  console.log('bookings.vehicle_type:', colRes.rows[0] || 'MISSING');

  const triggers = await db.query(
    `SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
     FROM pg_trigger
     WHERE tgname IN ('trigger_set_booking_vehicle_type', 'trigger_validate_booking_vehicle_capacity')
       AND NOT tgisinternal`
  );
  console.log('\nTriggers:');
  for (const t of triggers.rows) {
    console.log(`  ${t.tgname} (enabled=${t.tgenabled})`);
  }

  try {
    await db.query(`SELECT 'ELECTRIC'::vehicle_type_enum AS vt`);
    console.log('\nvehicle_type_enum cast: OK');
  } catch (e) {
    console.log('\nvehicle_type_enum cast: FAIL', e.code, e.message);
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const slot = await client.query(
      `SELECT s.id FROM slots s WHERE s.status IN ('available','full') LIMIT 1`
    );
    const vehicle = await client.query(`SELECT id, name FROM vehicles WHERE is_active = true LIMIT 1`);
    const admin = await client.query(`SELECT id FROM profiles WHERE role IN ('admin','subadmin') LIMIT 1`);
    if (slot.rows[0] && vehicle.rows[0] && admin.rows[0]) {
      const ref = await client.query('SELECT generate_offline_reference_number() AS ref');
      await client.query(
        `INSERT INTO bookings (
          user_id, slot_id, trainer_id, vehicle_id, vehicle_type, phone, status, notes,
          booking_source, created_by_admin_id, offline_customer_name,
          offline_reference_number, attendance_status
        ) VALUES (
          NULL, $1, NULL, $2, 'ELECTRIC'::vehicle_type_enum, NULL, 'confirmed', NULL,
          'OFFLINE', $3, 'Trigger probe', $4, 'SCHEDULED'::attendance_status_enum
        )`,
        [slot.rows[0].id, vehicle.rows[0].id, admin.rows[0].id, ref.rows[0].ref]
      );
      console.log('trigger_set_booking_vehicle_type path: OK (rolled back)');
    }
    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    console.log('INSERT probe: FAIL', e.code, e.message);
  } finally {
    client.release();
  }

  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
