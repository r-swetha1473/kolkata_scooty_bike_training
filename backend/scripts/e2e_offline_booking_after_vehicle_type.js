/**
 * End-to-end offline booking test after vehicle_type migration.
 * Uses createOfflineBooking service (same path as POST /api/admin/offline-bookings).
 */
require('dotenv').config();
const db = require('../db');
const { createOfflineBooking } = require('../services/offlineBooking.service');

async function main() {
  const adminRes = await db.query(
    `SELECT id, email, role FROM profiles WHERE role IN ('admin', 'superadmin') ORDER BY role LIMIT 1`
  );
  if (!adminRes.rows[0]) {
    throw new Error('No admin profile found');
  }
  const admin = adminRes.rows[0];

  const slotRes = await db.query(
    `SELECT s.id AS slot_id, v.id AS vehicle_id, v.name AS vehicle_name
     FROM slots s
     CROSS JOIN vehicles v
     WHERE s.status IN ('available', 'full')
       AND v.is_active = true
       AND s.booked_count < s.capacity
     LIMIT 1`
  );
  if (!slotRes.rows[0]) {
    throw new Error('No available slot+vehicle for test booking');
  }
  const { slot_id, vehicle_id, vehicle_name } = slotRes.rows[0];

  const beforeCount = await db.query(
    `SELECT COUNT(*)::int AS n FROM bookings WHERE booking_source = 'OFFLINE'`
  );

  console.log('Admin:', admin.email, admin.role);
  console.log('Slot:', slot_id, '| Vehicle:', vehicle_name, vehicle_id);
  console.log('Offline bookings before:', beforeCount.rows[0].n);

  const result = await createOfflineBooking(admin.id, {
    slot_id,
    vehicle_id,
    customer_name: 'Schema Fix E2E Test',
    notes: 'Post vehicle_type migration validation'
  });

  console.log('\n=== CREATE RESULT ===');
  console.log(JSON.stringify(result, null, 2));

  const checks = [];
  checks.push(['booking id present', !!result.id]);
  checks.push(['reference OFF-*', /^OFF-\d{6}$/.test(result.offline_reference_number || '')]);
  checks.push(['first ref OFF-000001', result.offline_reference_number === 'OFF-000001']);
  checks.push(['source OFFLINE', result.booking_source === 'OFFLINE']);
  checks.push(['vehicle_id matches', result.vehicle_id === vehicle_id]);
  checks.push(['vehicle_name present', !!result.vehicle_name]);

  const row = await db.query(
    `SELECT b.id, b.booking_source, b.vehicle_type, b.vehicle_id, b.offline_reference_number,
            b.offline_customer_name, v.name AS vehicle_name
     FROM bookings b
     LEFT JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.id = $1`,
    [result.id]
  );
  const dbRow = row.rows[0];
  checks.push(['DB vehicle_type set', !!dbRow?.vehicle_type]);
  checks.push(['DB booking_source OFFLINE', dbRow?.booking_source === 'OFFLINE']);

  const listRes = await db.query(
    `SELECT id, offline_reference_number, booking_source, offline_customer_name
     FROM bookings
     WHERE booking_source = 'OFFLINE'
     ORDER BY created_at DESC
     LIMIT 5`
  );
  const inList = listRes.rows.some((r) => r.id === result.id);
  checks.push(['visible in offline bookings query', inList]);

  console.log('\n=== CHECKS ===');
  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) allPass = false;
  }

  console.log('\nDB row:', dbRow);
  console.log('\nRecent offline bookings:', listRes.rows);

  await db.pool.end();
  process.exit(allPass ? 0 : 1);
}

main().catch(async (err) => {
  console.error('E2E FAILED:', err.message);
  if (err.code) console.error('pgCode:', err.code);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
