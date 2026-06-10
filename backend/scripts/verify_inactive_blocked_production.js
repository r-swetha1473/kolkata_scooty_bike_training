/**
 * Verify profiles.inactive_blocked schema + affected API endpoints.
 * Usage: cd backend && node scripts/verify_inactive_blocked_production.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API = process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api';
const db = require('../db');

const report = {
  timestamp: new Date().toISOString(),
  schema: {},
  endpoints: {},
  pass: true
};

function fail(section, reason, detail = {}) {
  report.pass = false;
  report[section] = { pass: false, reason, ...detail };
}

function ok(section, detail = {}) {
  report[section] = { pass: true, ...detail };
}

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, raw: text };
}

async function checkSchema() {
  const cols = await db.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN ('inactive_blocked', 'last_booking_date')
    ORDER BY column_name
  `);
  const names = cols.rows.map((r) => r.column_name);
  const hasInactive = names.includes('inactive_blocked');
  const hasLastBooking = names.includes('last_booking_date');
  if (!hasInactive) {
    fail('schema', 'profiles.inactive_blocked missing on production DB', { columns: cols.rows });
  } else {
    const col = cols.rows.find((r) => r.column_name === 'inactive_blocked');
    ok('schema', {
      inactive_blocked: col,
      last_booking_date: cols.rows.find((r) => r.column_name === 'last_booking_date') || null
    });
  }
  return { hasInactive, hasLastBooking };
}

async function loginAdmin() {
  const { requireAdminCreds } = require('./lib/requireAdminCreds');
  const { email, password } = requireAdminCreds();
  const res = await req('POST', '/auth/login', { body: { email, password } });
  return res.status === 200 ? res.data?.token : null;
}

async function checkEndpoints(adminToken) {
  const endpoints = {};

  if (adminToken) {
    const me = await req('GET', '/auth/me', { token: adminToken });
    endpoints.auth_me = {
      status: me.status,
      has_inactive_blocked: me.data?.inactive_blocked !== undefined,
      inactive_blocked: me.data?.inactive_blocked
    };

    const profile = await req('GET', '/profiles/me', { token: adminToken });
    endpoints.profiles_me = {
      status: profile.status,
      has_inactive_blocked: profile.data?.inactive_blocked !== undefined,
      inactive_blocked: profile.data?.inactive_blocked
    };

    const users = await req('GET', '/admin/users?limit=3', { token: adminToken });
    const sample = users.data?.users?.[0];
    endpoints.admin_users = {
      status: users.status,
      errorCode: users.data?.errorCode,
      sample_inactive_blocked: sample?.inactive_blocked,
      total: users.data?.total
    };

    const bookings = await req('GET', '/admin/bookings?limit=3', { token: adminToken });
    endpoints.admin_bookings = {
      status: bookings.status,
      errorCode: bookings.data?.errorCode
    };
  } else {
    endpoints.skipped = 'Admin login failed — check credentials';
  }

  const bookingQuery = await db.query(
    `SELECT phone, role, inactive_blocked FROM profiles WHERE role = 'customer' LIMIT 1`
  );
  endpoints.booking_preflight_sql = {
    pass: bookingQuery.rows.length >= 0,
    sample: bookingQuery.rows[0]
      ? {
          role: bookingQuery.rows[0].role,
          inactive_blocked: bookingQuery.rows[0].inactive_blocked
        }
      : null
  };

  const health = await req('GET', '/health');
  endpoints.health = { status: health.status };

  ok('endpoints', endpoints);
}

async function main() {
  console.log('=== inactive_blocked production verification ===');
  console.log('API:', API);
  const { hasInactive } = await checkSchema();
  console.log('Schema:', JSON.stringify(report.schema, null, 2));

  const adminToken = await loginAdmin();
  await checkEndpoints(adminToken);
  console.log('Endpoints:', JSON.stringify(report.endpoints, null, 2));

  console.log('\n--- Summary ---');
  console.log('inactive_blocked column exists:', hasInactive);
  console.log('Overall:', report.pass ? 'PASS' : 'FAIL');
  console.log(JSON.stringify(report, null, 2));

  await db.pool.end();
  process.exit(report.pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await db.pool.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
