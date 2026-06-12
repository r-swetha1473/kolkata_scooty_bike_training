/**
 * Verify and optionally bootstrap account_reactivation_requests on production Neon.
 * Usage: cd backend && node scripts/verify_reactivation_production.js
 */
require('dotenv').config();
const db = require('../db');
const reactivationService = require('../services/reactivationRequest.service');

const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');

async function tableExists() {
  const r = await db.query(
    `SELECT table_name, table_schema
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'account_reactivation_requests'`
  );
  return r.rows[0] || null;
}

async function columnCheck() {
  const r = await db.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'account_reactivation_requests'
     ORDER BY ordinal_position`
  );
  return r.rows;
}

async function indexCheck() {
  const r = await db.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'account_reactivation_requests'
     ORDER BY indexname`
  );
  return r.rows;
}

async function findInactiveCustomer() {
  const r = await db.query(
    `SELECT id, email, full_name, inactive_blocked
     FROM profiles
     WHERE role = 'customer' AND inactive_blocked = true
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 1`
  );
  return r.rows[0] || null;
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiPost(path, token, body = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function findAdmin() {
  const r = await db.query(
    `SELECT id, email, role FROM profiles
     WHERE role IN ('admin', 'superadmin')
     ORDER BY CASE role WHEN 'superadmin' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return r.rows[0] || null;
}

async function main() {
  console.log('=== Reactivation Production Verification ===\n');

  const before = await tableExists();
  console.log('1) Table check (before):', before ? 'EXISTS' : 'MISSING');

  if (!before) {
    console.log('2) Applying schema bootstrap...');
    const result = await reactivationService.ensureSchemaOnStartup();
    console.log('   Bootstrap result:', result);
  } else {
    console.log('2) Schema bootstrap: skipped (table already exists)');
  }

  const after = await tableExists();
  console.log('3) Table check (after):', after ? 'EXISTS' : 'MISSING');
  if (!after) {
    console.error('\nFAIL: account_reactivation_requests still missing');
    process.exit(1);
  }

  const columns = await columnCheck();
  const indexes = await indexCheck();
  console.log('\n4) Columns:', columns.map((c) => c.column_name).join(', '));
  console.log('5) Indexes:', indexes.map((i) => i.indexname).join(', '));

  const requiredColumns = [
    'id', 'user_id', 'status', 'requested_at', 'reviewed_at', 'reviewed_by', 'admin_notes', 'user_message'
  ];
  const missingCols = requiredColumns.filter(
    (name) => !columns.some((c) => c.column_name === name)
  );
  if (missingCols.length) {
    console.error('\nFAIL: Missing columns:', missingCols.join(', '));
    process.exit(1);
  }

  const inactive = await findInactiveCustomer();
  console.log('\n6) Inactive customer sample:', inactive
    ? `${inactive.full_name || inactive.email} (${inactive.id})`
    : 'none found');

  const unauth = await apiPost('/profile/reactivation-request', null, {});
  console.log('\n7) Unauthenticated POST:', unauth.status, unauth.data?.errorCode || '');

  if (inactive) {
    const pending = await db.query(
      `SELECT id, status FROM account_reactivation_requests
       WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
      [inactive.id]
    );
    console.log('8) Existing pending for inactive user:', pending.rows[0]?.id || 'none');

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: inactive.id, email: inactive.email, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const create = await apiPost('/profile/reactivation-request', token, {});
    console.log('9) Authenticated inactive POST:', create.status, create.data?.message || create.data?.errorCode || '');

    if (create.status === 201) {
      const notif = await db.query(
        `SELECT type, title, body, entity_type, entity_id, created_at
         FROM admin_notifications
         WHERE type = 'account_reactivation_request'
         ORDER BY created_at DESC
         LIMIT 1`
      );
      console.log('10) Latest admin notification:', notif.rows[0] || 'none');

      const dup = await apiPost('/profile/reactivation-request', token, {});
      console.log('11) Duplicate pending POST:', dup.status, dup.data?.errorCode || dup.data?.message || '');
    } else if (create.status === 409) {
      console.log('10) Request already pending (duplicate protection active)');
      const dup = await apiPost('/profile/reactivation-request', token, {});
      console.log('11) Duplicate pending POST:', dup.status, dup.data?.errorCode || dup.data?.message || '');
    }
  } else {
    console.log('8-11) Skipped authenticated flow — no inactive_blocked customer in DB');
  }

  const admin = await findAdmin();
  if (admin) {
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const list = await apiGet('/admin/reactivation-requests?status=pending', adminToken);
    console.log('\n12) Admin list GET:', list.status, 'total=', list.data?.total);
    const row = list.data?.requests?.[0];
    if (row) {
      console.log('13) Admin row fields:', {
        user_name: row.user_name,
        user_email: row.user_email,
        user_phone: row.user_phone,
        status: row.status,
        requested_at: row.requested_at
      });
    }
  } else {
    console.log('\n12) Admin list GET: skipped (no admin user)');
  }

  const count = await db.query(`SELECT COUNT(*)::int AS c FROM account_reactivation_requests`);
  console.log('\n14) Total reactivation requests:', count.rows[0]?.c ?? 0);

  console.log('\nPASS: Reactivation schema and API checks complete');
  await db.pool.end();
}

main().catch(async (err) => {
  console.error('ERROR:', err.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
