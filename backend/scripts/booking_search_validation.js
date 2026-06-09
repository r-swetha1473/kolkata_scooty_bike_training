/**
 * Validate admin booking search SQL.
 * Usage: cd backend && node scripts/booking_search_validation.js
 */
require('dotenv').config();
const db = require('../db');
const { buildBookingListQuery } = require('../utils/bookingSearch');

async function runSearch(term) {
  const { countSql, countParams } = buildBookingListQuery({
    searchRaw: term,
    status: '',
    startDate: '',
    endDate: '',
    limit: 20,
    offset: 0
  });
  const r = await db.query(countSql, countParams);
  return r.rows[0]?.total ?? 0;
}

async function main() {
  console.log('Booking search validation\n');

  const sampleCustomer = await db.query(
    `SELECT u.full_name, b.id FROM bookings b
     JOIN profiles u ON b.user_id = u.id
     WHERE u.full_name IS NOT NULL LIMIT 1`
  );
  const sampleTrainer = await db.query(
    `SELECT p.full_name FROM bookings b
     JOIN trainers t ON b.trainer_id = t.id
     JOIN profiles p ON t.user_id = p.id
     WHERE p.full_name IS NOT NULL LIMIT 1`
  );
  const samplePhone = await db.query(
    `SELECT phone FROM bookings WHERE phone IS NOT NULL LIMIT 1`
  );
  const sampleVehicle = await db.query(
    `SELECT v.name FROM bookings b
     JOIN vehicles v ON b.vehicle_id = v.id
     WHERE v.name IS NOT NULL LIMIT 1`
  );

  const tests = [];
  if (sampleCustomer.rows[0]) {
    tests.push({ label: 'customer name', term: sampleCustomer.rows[0].full_name.split(' ')[0] });
    tests.push({ label: 'booking id prefix', term: String(sampleCustomer.rows[0].id).slice(0, 8) });
  }
  if (sampleTrainer.rows[0]) {
    tests.push({ label: 'trainer name', term: sampleTrainer.rows[0].full_name.split(' ')[0] });
  }
  if (samplePhone.rows[0]) {
    tests.push({ label: 'phone full', term: samplePhone.rows[0].phone });
    tests.push({ label: 'phone last4', term: String(samplePhone.rows[0].phone).slice(-4) });
  }
  if (sampleVehicle.rows[0]) {
    tests.push({ label: 'vehicle', term: sampleVehicle.rows[0].name.split(' ')[0] });
  }

  for (const t of tests) {
    const count = await runSearch(t.term);
    console.log(`${t.label} "${t.term}": ${count} match(es)`);
  }

  const statusPending = buildBookingListQuery({ searchRaw: '', status: 'pending', startDate: '', endDate: '', limit: 20, offset: 0 });
  const pendingR = await db.query(statusPending.countSql, statusPending.countParams);
  console.log(`status pending: ${pendingR.rows[0]?.total ?? 0}`);

  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
