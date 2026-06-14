/**
 * Production offline booking SQL path diagnostic — read-only simulation.
 * Usage: cd backend && node scripts/diagnose_offline_booking_production.js
 */
require('dotenv').config();
const db = require('../db');
const { parseDatabaseTarget } = require('../services/offlineBookingSchema.service');

const API = process.env.PRODUCTION_API_URL || 'https://kolkata-scooty-bike-training.onrender.com';

const STEPS = [];

function record(step, sql, fn) {
  STEPS.push({ step, sql, fn });
}

record('1_profiles_reuse_user', 'SELECT id FROM profiles WHERE id = $1 AND role = customer', async () => {
  await db.query(`SELECT id FROM profiles WHERE id = $1 AND role = 'customer'`, [
    '00000000-0000-0000-0000-000000000001'
  ]);
});

record('2_vehicle_by_id', 'SELECT id, name, max_per_slot, is_active FROM vehicles WHERE id = $1', async () => {
  const r = await db.query(`SELECT id FROM vehicles WHERE is_active = true LIMIT 1`);
  if (!r.rows[0]) throw new Error('No active vehicle for probe');
  await db.query(`SELECT id, name, max_per_slot, is_active FROM vehicles WHERE id = $1`, [r.rows[0].id]);
  return r.rows[0].id;
});

record('3_vehicle_booked_count', 'COUNT bookings by slot_id + vehicle_id', async () => {
  const slot = await db.query(`SELECT id FROM slots WHERE status IN ('available','full') LIMIT 1`);
  const vehicle = await db.query(`SELECT id FROM vehicles WHERE is_active = true LIMIT 1`);
  if (!slot.rows[0] || !vehicle.rows[0]) throw new Error('Need slot+vehicle for probe');
  await db.query(
    `SELECT COUNT(*)::int AS count FROM bookings
     WHERE slot_id = $1 AND vehicle_id = $2 AND status NOT IN ('cancelled')`,
    [slot.rows[0].id, vehicle.rows[0].id]
  );
});

record('4_generate_offline_reference_number', 'SELECT generate_offline_reference_number()', async () => {
  await db.query('SELECT generate_offline_reference_number() AS ref');
});

record('5_offline_reference_fallback', 'MAX offline_reference_number fallback query', async () => {
  await db.query(
    `SELECT 'OFF-' || LPAD(
      (COALESCE(
        (SELECT MAX(CAST(SUBSTRING(offline_reference_number FROM 5) AS INTEGER))
         FROM bookings WHERE offline_reference_number IS NOT NULL),
        0
      ) + 1)::TEXT,
      6, '0'
    ) AS ref`
  );
});

record('6_select_offline_columns', 'SELECT all offline booking columns FROM bookings LIMIT 0', async () => {
  await db.query(
    `SELECT booking_source, created_by_admin_id, offline_customer_name,
            offline_customer_age, offline_customer_gender, offline_reference_number,
            attendance_status
     FROM bookings LIMIT 0`
  );
});

record('7_cast_enums', 'Cast booking_source_enum and attendance_status_enum', async () => {
  await db.query(
    `SELECT 'OFFLINE'::booking_source_enum AS src, 'SCHEDULED'::attendance_status_enum AS att`
  );
});

record('8_union_null_casts', 'UNION NULL casts (same as failed booking INSERT tail)', async () => {
  await db.query(
    `SELECT NULL::booking_source_enum AS booking_source,
            NULL::attendance_status_enum AS attendance_status`
  );
});

record('9_booking_events_insert_shape', 'INSERT shape into booking_events (rolled back)', async () => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const b = await client.query(`SELECT id FROM bookings LIMIT 1`);
    if (!b.rows[0]) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, title, description, actor_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [b.rows[0].id, 'PROBE', 'Probe', null, null, '{}']
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

record('10_dry_run_insert_offline', 'INSERT offline booking (ROLLBACK — no commit)', async () => {
  const slotRes = await db.query(
    `SELECT s.id AS slot_id, v.id AS vehicle_id
     FROM slots s
     CROSS JOIN vehicles v
     WHERE s.status IN ('available','full') AND v.is_active = true
     LIMIT 1`
  );
  if (!slotRes.rows[0]) throw new Error('No slot+vehicle for dry-run insert');
  const { slot_id: slotId, vehicle_id: vehicleId } = slotRes.rows[0];
  const adminRes = await db.query(`SELECT id FROM profiles WHERE role IN ('admin','subadmin') LIMIT 1`);
  if (!adminRes.rows[0]) throw new Error('No admin profile for dry-run');
  const refRes = await db.query('SELECT generate_offline_reference_number() AS ref');
  const ref = refRes.rows[0].ref;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO bookings (
        user_id, slot_id, trainer_id, vehicle_id, vehicle_type, phone, status, notes,
        booking_source, created_by_admin_id, offline_customer_name, offline_customer_age,
        offline_customer_gender, offline_reference_number, attendance_status
      ) VALUES (
        NULL, $1, NULL, $2, 'ELECTRIC'::vehicle_type_enum, NULL, 'confirmed', NULL,
        'OFFLINE', $3, 'DIAG_PROBE', NULL, NULL, $4, 'SCHEDULED'::attendance_status_enum
      ) RETURNING id`,
      [slotId, vehicleId, adminRes.rows[0].id, ref]
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

async function probeLocalSql() {
  console.log('=== LOCAL DATABASE SQL PATH PROBE ===');
  console.log('Target:', parseDatabaseTarget());
  console.log('');

  let firstFailure = null;
  for (const { step, sql, fn } of STEPS) {
    try {
      await fn();
      console.log(`OK   [${step}]`);
    } catch (error) {
      console.log(`FAIL [${step}]`);
      console.log('  pgCode:', error.code);
      console.log('  message:', error.message);
      console.log('  table:', error.table || '(n/a)');
      console.log('  column:', error.column || '(n/a)');
      console.log('  constraint:', error.constraint || '(n/a)');
      console.log('  sql:', sql);
      if (!firstFailure) {
        firstFailure = { step, sql, error };
      }
    }
  }
  return firstFailure;
}

async function probeProductionApi() {
  console.log('\n=== PRODUCTION API PROBE ===');
  console.log('API:', API);

  const version = await fetch(`${API}/api/version`).then((r) => r.json());
  console.log('Deployed commit:', version.commitShort, '| nodeEnv:', version.nodeEnv);

  const email = process.env.ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SKIP live POST — set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
    return null;
  }

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginBody = await loginRes.json();
  const token = loginBody.token;
  if (!token) {
    console.log('LOGIN FAILED', loginRes.status, JSON.stringify(loginBody));
    return null;
  }
  console.log('LOGIN OK');

  const today = new Date().toISOString().slice(0, 10);
  const slotsRes = await fetch(`${API}/api/slots/date/${today}?bookable_only=true`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const slots = await slotsRes.json();
  const slotList = Array.isArray(slots) ? slots : [];
  const slot = slotList.find((s) => s.status === 'available' && (s.booked_count || 0) < (s.capacity || 999));
  if (!slot) {
    console.log('NO AVAILABLE SLOT for today — try tomorrow');
    return null;
  }
  const vc = (slot.vehicle_capacities || []).find((v) => (v.booked || 0) < (v.capacity || 0));
  if (!vc?.vehicle_id) {
    console.log('NO VEHICLE CAPACITY on slot', slot.id);
    return null;
  }

  const payload = {
    slot_id: slot.id,
    vehicle_id: vc.vehicle_id,
    customer_name: 'Production Diag Probe',
    notes: 'diagnostic-only'
  };

  const postRes = await fetch(`${API}/api/admin/offline-bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const postText = await postRes.text();
  let postBody;
  try {
    postBody = JSON.parse(postText);
  } catch {
    postBody = { raw: postText.slice(0, 500) };
  }

  console.log('POST /api/admin/offline-bookings status:', postRes.status);
  console.log('Response:', JSON.stringify(postBody, null, 2));

  if (postBody.schemaDetail) {
    console.log('\n*** EXACT PG ERROR FROM PRODUCTION ***');
    console.log(JSON.stringify(postBody.schemaDetail, null, 2));
  }

  return { status: postRes.status, body: postBody };
}

async function main() {
  const { auditOfflineBookingSchema } = require('../services/offlineBookingSchema.service');
  const audit = await auditOfflineBookingSchema();

  console.log('=== SCHEMA AUDIT (connected DATABASE_URL) ===');
  console.log('Target:', audit.target);
  console.log('OK:', audit.ok);
  if (!audit.ok) {
    console.log('Missing:', JSON.stringify(audit.missing, null, 2));
    console.log('Required migrations:', audit.requiredMigrations);
  }
  console.log('');

  const sqlFailure = await probeLocalSql();
  const apiResult = await probeProductionApi();

  console.log('\n=== DIAGNOSIS SUMMARY ===');
  if (sqlFailure) {
    console.log('First local SQL failure:', sqlFailure.step);
    console.log('  pgCode:', sqlFailure.error.code);
    console.log('  message:', sqlFailure.error.message);
    console.log('  column:', sqlFailure.error.column);
    console.log('  table:', sqlFailure.error.table);
  } else if (audit.ok) {
    console.log('Local DATABASE_URL: all offline SQL probes PASS');
  }

  if (apiResult?.body?.schemaDetail) {
    console.log('Production exact error:', apiResult.body.schemaDetail.pgMessage);
    console.log('Production pgCode:', apiResult.body.schemaDetail.pgCode);
    console.log('Production column:', apiResult.body.schemaDetail.pgColumn);
  } else if (apiResult?.status === 201) {
    console.log('Production offline booking SUCCEEDED — issue may be resolved or env-specific');
  } else if (apiResult?.status === 503) {
    console.log('Production returned 503 SCHEMA_MISMATCH but schemaDetail not in response');
    console.log('Check Render logs for: [Schema] SCHEMA_MISMATCH — PostgreSQL object missing');
  }

  await db.pool.end();
  process.exit(sqlFailure || !audit.ok ? 1 : 0);
}

main().catch(async (err) => {
  console.error('FATAL:', err.message);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
