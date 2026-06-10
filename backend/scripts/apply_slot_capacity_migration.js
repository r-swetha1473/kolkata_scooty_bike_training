/**
 * Inspect, apply, and verify slot capacity migration on Neon.
 * Usage:
 *   DATABASE_URL=postgresql://... node backend/scripts/apply_slot_capacity_migration.js
 * Optional:
 *   APPLY_MIGRATION=1  — run migration SQL (default: inspect only if not set)
 *   API_BASE=https://kolkata-scooty-bike-training.onrender.com/api
 *   ADMIN_EMAIL / ADMIN_PASSWORD — trigger recalc after migration
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const MIGRATION = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260610140000_slot_capacity_sum_limit.sql');
const API = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');
const APPLY = process.env.APPLY_MIGRATION === '1' || process.argv.includes('--apply');

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(slot_date, (start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

async function inspectConstraint(client) {
  const r = await client.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'slots' AND c.conname = 'slots_capacity_check'
  `);
  return r.rows[0]?.def || null;
}

async function getCapacitySnapshot(client) {
  const vehicles = await client.query(
    `SELECT name, max_per_slot, is_active FROM vehicles ORDER BY name`
  );
  const active = vehicles.rows.filter((v) => v.is_active !== false);
  const expected = active.reduce((s, v) => s + (Number(v.max_per_slot) || 0), 0);
  const slots = await client.query(`
    SELECT capacity, COUNT(*)::int AS cnt
    FROM slots
    WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
    GROUP BY capacity
    ORDER BY capacity
  `);
  return { vehicles: vehicles.rows, active, expected: Math.max(1, expected), capacityDistribution: slots.rows };
}

async function apiRecalc() {
  const { requireAdminCreds } = require('./lib/requireAdminCreds');
  const { email, password } = requireAdminCreds();
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await login.json();
  if (!login.ok) return { ok: false, step: 'login', status: login.status, data: loginData };
  const recalc = await fetch(`${API}/admin/slots/recalculate-capacity`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginData.token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const recalcData = await recalc.json().catch(() => ({}));
  return { ok: recalc.status === 200, step: 'recalc', status: recalc.status, data: recalcData, token: loginData.token };
}

async function apiModuleChecks(token) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const ts = Date.now();
  const vCreate = await fetch(`${API}/vehicles`, {
    method: 'POST', headers,
    body: JSON.stringify({ name: `CapVerify ${ts}`, max_per_slot: 1, is_active: false })
  });
  const vCreateData = await vCreate.json().catch(() => ({}));
  let vDelete = { status: 0 };
  if (vCreate.ok && vCreateData.id) {
    vDelete = await fetch(`${API}/vehicles/${vCreateData.id}`, { method: 'DELETE', headers });
  }
  const settingsGet = await fetch(`${API}/admin/settings`, { headers });
  const settingsData = await settingsGet.json().catch(() => ({}));
  const settingsPut = await fetch(`${API}/admin/settings`, {
    method: 'PUT', headers, body: JSON.stringify(settingsData)
  });
  return {
    vehicleCreate: { status: vCreate.status, id: vCreateData.id },
    vehicleDelete: { status: vDelete.status },
    settingsGet: { status: settingsGet.status },
    settingsPut: { status: settingsPut.status }
  };
}

async function main() {
  const report = { timestamp: new Date().toISOString(), migrationFile: MIGRATION, steps: {} };

  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    report.error = 'DATABASE_URL not set. Set in backend/.env or environment.';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const db = require('../db');
  const client = await db.getClient();
  try {
    report.steps.before = {
      constraint: await inspectConstraint(client),
      snapshot: await getCapacitySnapshot(client)
    };

    if (APPLY) {
      const sql = fs.readFileSync(MIGRATION, 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      report.steps.migration = { applied: true, file: path.basename(MIGRATION) };
    } else {
      report.steps.migration = { applied: false, note: 'Pass --apply or APPLY_MIGRATION=1 to run SQL' };
    }

    report.steps.after = {
      constraint: await inspectConstraint(client),
      snapshot: await getCapacitySnapshot(client)
    };

    const recalcApi = await apiRecalc();
    report.steps.apiRecalc = recalcApi;

    if (recalcApi.token) {
      report.steps.moduleChecks = await apiModuleChecks(recalcApi.token);
    }

    if (recalcApi.ok) {
      const afterApi = await fetch(`${API}/slots/available`).then((r) => r.json());
      const slots = Array.isArray(afterApi) ? afterApi : afterApi.slots || [];
      report.steps.afterApi = {
        sampleCapacity: slots[0]?.capacity,
        distinctCapacities: [...new Set(slots.map((s) => s.capacity))]
      };
    }

    const expected = report.steps.after?.snapshot?.expected;
    const caps = report.steps.after?.snapshot?.capacityDistribution || [];
    const allMatch = caps.length === 1 && caps[0].capacity === expected;
    report.pass = allMatch && recalcApi.ok && (report.steps.after.constraint || '').includes('<= 100');
    report.expectedCapacity = expected;
  } finally {
    client.release();
    await db.pool.end();
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
