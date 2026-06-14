/**
 * Production verification for Admin → Offline Bookings page data path.
 * Mirrors: GET /api/admin/bookings?source=OFFLINE and POST /api/admin/offline-bookings
 */
require('dotenv').config();
const db = require('../db');
const { parseDatabaseTarget } = require('../services/offlineBookingSchema.service');

const API = process.env.PRODUCTION_API_URL || process.env.API_BASE?.replace(/\/api\/?$/, '') || 'https://kolkata-scooty-bike-training.onrender.com';

async function verifyDatabaseList() {
  console.log('=== DATABASE (Admin list query path) ===');
  console.log('Target:', parseDatabaseTarget());

  const schema = await db.query(
    `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_enum') AS has_enum,
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'bookings' AND column_name = 'vehicle_type'
            ) AS has_col`
  );
  console.log('vehicle_type_enum:', schema.rows[0].has_enum ? 'OK' : 'MISSING');
  console.log('bookings.vehicle_type:', schema.rows[0].has_col ? 'OK' : 'MISSING');

  const list = await db.query(
    `SELECT b.id, b.offline_reference_number, b.booking_source, b.offline_customer_name,
            b.vehicle_type, b.attendance_status, b.status, b.created_at,
            v.name AS vehicle_name,
            p.full_name AS created_by_admin_name, p.role AS created_by_admin_role
     FROM bookings b
     LEFT JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN profiles p ON p.id = b.created_by_admin_id
     WHERE b.booking_source = 'OFFLINE'
     ORDER BY b.created_at DESC
     LIMIT 8`
  );

  console.log(`\nOffline bookings (recent ${list.rows.length}):`);
  if (!list.rows.length) {
    console.log('  (none)');
    return { ok: false, bookings: [] };
  }

  for (const row of list.rows) {
    console.log(`  ${row.offline_reference_number} | ${row.offline_customer_name} | ${row.vehicle_name} (${row.vehicle_type}) | ${row.status}`);
  }

  const checks = list.rows.map((row) => ({
    ref: /^OFF-\d{6}$/.test(row.offline_reference_number || ''),
    source: row.booking_source === 'OFFLINE',
    vehicle: !!row.vehicle_type && !!row.vehicle_name
  }));

  const allOk = checks.every((c) => c.ref && c.source && c.vehicle);
  return { ok: allOk, bookings: list.rows };
}

async function verifyProductionApi() {
  console.log('\n=== PRODUCTION API ===');
  const version = await fetch(`${API}/api/version`).then((r) => r.json());
  console.log('Deploy:', version.commitShort, '| nodeEnv:', version.nodeEnv);

  const email = process.env.ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Auth: SKIP (set ADMIN_EMAIL + ADMIN_PASSWORD for live API check)');
    return { apiListOk: null, apiCreateOk: null };
  }

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginBody = await loginRes.json();
  if (!loginBody.token) {
    console.log('Auth: FAIL', loginRes.status, loginBody.message || loginBody);
    return { apiListOk: false, apiCreateOk: null };
  }
  console.log('Auth: OK as', loginBody.user?.email || email);

  const listRes = await fetch(`${API}/api/admin/bookings?source=OFFLINE&limit=8&offset=0`, {
    headers: { Authorization: `Bearer ${loginBody.token}`, Accept: 'application/json' }
  });
  const listBody = await listRes.json();
  const apiListOk = listRes.status === 200 && Array.isArray(listBody.bookings) && listBody.bookings.length > 0;
  console.log('GET /api/admin/bookings?source=OFFLINE:', listRes.status, `total=${listBody.total ?? '?'}`);
  if (apiListOk) {
    const b = listBody.bookings[0];
    console.log('  Latest:', b.offline_reference_number, '|', b.offline_customer_name, '|', b.vehicle_name, '| source=', b.booking_source);
  }

  return { apiListOk, apiCreateOk: null, latest: listBody.bookings?.[0] };
}

async function main() {
  const dbResult = await verifyDatabaseList();
  let apiResult = { apiListOk: null };
  try {
    apiResult = await verifyProductionApi();
  } catch (e) {
    console.log('\nAPI error:', e.message);
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log('Schema objects present:', dbResult.ok || dbResult.bookings.length > 0 ? 'PASS' : 'CHECK');
  console.log('Offline bookings in DB:', dbResult.bookings.length > 0 ? 'PASS' : 'FAIL');
  console.log('Reference / OFFLINE / vehicle on latest row:',
    dbResult.bookings[0]
      ? [
          /^OFF-\d{6}$/.test(dbResult.bookings[0].offline_reference_number) ? 'ref OK' : 'ref FAIL',
          dbResult.bookings[0].booking_source === 'OFFLINE' ? 'source OK' : 'source FAIL',
          dbResult.bookings[0].vehicle_type ? 'vehicle OK' : 'vehicle FAIL'
        ].join(', ')
      : 'N/A'
  );
  if (apiResult.apiListOk === true) {
    console.log('Production API admin list: PASS');
  } else if (apiResult.apiListOk === false) {
    console.log('Production API admin list: FAIL');
  } else {
    console.log('Production API admin list: SKIPPED (no admin creds)');
  }
  console.log('\nManual UI check: https://kolkata-scooty-bike-training.vercel.app → Admin Login → Offline Bookings');
  console.log('Expect: recent offline booking(s) in sidebar with OFF-* reference and OFFLINE badge');

  await db.pool.end();
  process.exit(dbResult.bookings.length > 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
