/**
 * Read-only production dashboard diagnosis — no mutations.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../db');

const API = 'https://kolkata-scooty-bike-training.onrender.com';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 1500) };
  }
  return { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
}

async function main() {
  console.log('=== GET /api/version ===');
  const version = await fetchJson(`${API}/api/version`);
  console.log('HTTP', version.status);
  console.log(JSON.stringify(version.body, null, 2));

  console.log('\n=== Deployed source check (GitHub raw @ commitShort) ===');
  const short = version.body.commitShort || '054bc08';
  const files = [
    'backend/services/dashboardStats.service.js',
    'backend/services/operationalAnalytics.service.js'
  ];
  for (const f of files) {
    const url = `https://raw.githubusercontent.com/r-swetha1473/kolkata_scooty_bike_training/${short}/${f}`;
    const res = await fetch(url);
    const text = await res.text();
    const hasFix = text.includes('FROM slots s WHERE capacity_exceeded');
    const hasBug = /FROM slots WHERE capacity_exceeded/.test(text);
    console.log(`${f}: http=${res.status} fix=${hasFix} oldBug=${hasBug}`);
  }

  console.log('\n=== GET /api/admin/stats (authenticated) ===');
  const admin = await db.query(
    `SELECT id, email, role FROM profiles WHERE role IN ('superadmin','admin') ORDER BY role LIMIT 1`
  );
  const user = admin.rows[0];
  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1h'
  });

  const stats = await fetchJson(`${API}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  console.log('Admin:', user.email);
  console.log('HTTP', stats.status);
  console.log('errorCode:', stats.body.errorCode || '(none)');
  console.log('message:', stats.body.message || '(none)');
  if (stats.body.schemaDetail) {
    console.log('schemaDetail:', JSON.stringify(stats.body.schemaDetail, null, 2));
  }
  if (stats.status === 200) {
    console.log('Payload sample:', {
      totalBookings: stats.body.totalBookings,
      todayBookings: stats.body.todayBookings,
      capacityExceededSlots: stats.body.capacityExceededSlots,
      systemHealth: stats.body.systemHealth
    });
  } else {
    console.log('Full body:', JSON.stringify(stats.body, null, 2).slice(0, 2500));
  }

  console.log('\n=== Local getDashboardStats() on production DATABASE_URL ===');
  try {
    const { getDashboardStats } = require('../services/dashboardStats.service');
    const local = await getDashboardStats();
    console.log('PASS totalBookings=', local.totalBookings, 'capacityExceededSlots=', local.capacityExceededSlots);
  } catch (e) {
    console.log('FAIL pgCode=', e.code, 'message=', e.message);
  }

  console.log('\n=== Vercel frontend ===');
  const fe = await fetch('https://kolkata-scooty-bike-training.vercel.app/');
  const html = await fe.text();
  const mainMatch = html.match(/main-[A-Z0-9]+\.js/);
  const apiInBundle = html.includes('onrender.com');
  console.log('main chunk:', mainMatch ? mainMatch[0] : '(not found in index)');
  console.log('index references onrender:', apiInBundle);

  await db.pool.end();
}

main().catch(async (e) => {
  console.error('FATAL', e);
  try {
    await db.pool.end();
  } catch {}
  process.exit(1);
});
