/**
 * Diagnose bookings constraint violations on connected DATABASE_URL.
 * Usage: cd backend && node scripts/diagnose_booking_constraint.js
 */
require('dotenv').config();
const db = require('../db');

async function listBookingConstraints() {
  const r = await db.query(
    `SELECT con.conname,
            con.contype,
            pg_get_constraintdef(con.oid) AS definition
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public' AND rel.relname = 'bookings'
     ORDER BY con.conname`
  );
  return r.rows;
}

async function listBookingIndexes() {
  const r = await db.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'bookings'
     ORDER BY indexname`
  );
  return r.rows;
}

async function findActiveCustomer() {
  const r = await db.query(
    `SELECT id, email, phone, inactive_blocked
     FROM profiles
     WHERE role = 'customer' AND COALESCE(inactive_blocked, false) = false
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`
  );
  return r.rows[0];
}

async function findBookableSlot() {
  const r = await db.query(
    `SELECT s.id, s.start_time, s.end_time, s.slot_date, s.status, s.capacity, s.booked_count,
            v.id AS vehicle_id, v.name AS vehicle_name, v.is_active,
            (SELECT COUNT(*)::int FROM bookings b
             WHERE b.slot_id = s.id AND b.vehicle_id = v.id AND b.status NOT IN ('cancelled')) AS vehicle_booked
     FROM slots s
     CROSS JOIN vehicles v
     WHERE v.is_active = true
       AND s.status IN ('available', 'full')
       AND s.start_time > NOW()
       AND s.start_time <= NOW() + INTERVAL '24 hours'
     ORDER BY s.start_time ASC
     LIMIT 5`
  );
  return r.rows;
}

async function tryInsert(userId, slotId, vehicleId, phone) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO bookings (user_id, slot_id, trainer_id, vehicle_id, phone, status, notes)
       VALUES ($1, $2, NULL, $3, $4, 'pending', NULL)
       RETURNING id`,
      [userId, slotId, vehicleId, phone]
    );
    await client.query('ROLLBACK');
    return { ok: true, id: result.rows[0]?.id };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return {
      ok: false,
      code: error.code,
      constraint: error.constraint,
      detail: error.detail,
      message: error.message,
      table: error.table,
      column: error.column
    };
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== Booking Constraint Diagnosis ===\n');

  const constraints = await listBookingConstraints();
  console.log('BOOKING CONSTRAINTS:');
  for (const c of constraints) {
    console.log(`- ${c.conname} (${c.contype}): ${c.definition}`);
  }

  const indexes = await listBookingIndexes();
  console.log('\nBOOKING INDEXES:');
  for (const i of indexes) {
    console.log(`- ${i.indexname}: ${i.indexdef}`);
  }

  const customer = await findActiveCustomer();
  console.log('\nSAMPLE ACTIVE CUSTOMER:', customer
    ? { id: customer.id, email: customer.email, phone: customer.phone?.slice(-4) }
    : 'none');

  const slots = await findBookableSlot();
  console.log('\nBOOKABLE SLOT CANDIDATES:', slots.length);
  for (const s of slots) {
    console.log({
      slot_id: s.id,
      vehicle_id: s.vehicle_id,
      vehicle_name: s.vehicle_name,
      start_time: s.start_time,
      status: s.status,
      vehicle_booked: s.vehicle_booked
    });
  }

  if (customer && slots[0]) {
    const phone = String(customer.phone || '').replace(/\D/g, '').slice(-10) || '9876543210';
    console.log('\nTEST INSERT (rolled back):');
    const attempt = await tryInsert(customer.id, slots[0].id, slots[0].vehicle_id, phone);
    console.log(attempt);
  }

  const nullTrainerDup = await db.query(
    `SELECT slot_id, COUNT(*)::int AS c
     FROM bookings
     WHERE trainer_id IS NULL AND status NOT IN ('cancelled')
     GROUP BY slot_id
     HAVING COUNT(*) > 1
     ORDER BY c DESC
     LIMIT 5`
  );
  console.log('\nSLOTS WITH MULTIPLE NULL-TRAINER BOOKINGS:', nullTrainerDup.rows);

  await db.pool.end();
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
