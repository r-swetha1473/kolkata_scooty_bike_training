/**
 * Verify GET /api/admin/users against live or local API.
 * Usage: API_BASE=https://kolkata-scooty-bike-training.onrender.com/api ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/verify_users_api.js
 */
require('dotenv').config();

const { requireAdminCreds } = require('./lib/requireAdminCreds');
const API_BASE = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');
const { email: EMAIL, password: PASSWORD } = requireAdminCreds();

async function login() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Login failed ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data.token || data.accessToken;
}

async function getUsers(token, qs = '') {
  const res = await fetch(`${API_BASE}/admin/users${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log('API_BASE:', API_BASE);
  const token = await login();
  console.log('Login: OK');

  const all = await getUsers(token);
  console.log('\n--- GET /admin/users (before fix on prod) ---');
  console.log('status:', all.status);
  if (all.status === 200) {
    const users = Array.isArray(all.data) ? all.data : all.data?.users;
    console.log('shape:', Array.isArray(all.data) ? 'array' : typeof all.data);
    console.log('count:', users?.length ?? 0);
    console.log('total:', all.data?.total ?? users?.length);
    const googleLeaks = (users || []).filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
    console.log('google_phone_leaks:', googleLeaks.length);
    const rajani = (users || []).find((u) => /rajani/i.test(u.full_name || ''));
    const indhuja = (users || []).find((u) => /indhuja/i.test(u.full_name || ''));
    if (rajani) console.log('Rajani Saha phone:', rajani.phone, 'source:', rajani.phone_source);
    if (indhuja) console.log('Indhuja phone:', indhuja.phone, 'source:', indhuja.phone_source);
    const bookingFallback = (users || []).filter((u) => u.phone_source === 'booking').length;
    const missing = (users || []).filter((u) => !u.phone).length;
    console.log('missing_phone:', missing, 'booking_fallback:', bookingFallback);
    if (users?.[0]) console.log('sample:', JSON.stringify(users[0], null, 2));
  } else {
    console.log('error:', typeof all.data === 'string' ? all.data.slice(0, 500) : JSON.stringify(all.data, null, 2));
  }

  const customers = await getUsers(token, '?role=customer');
  console.log('\n--- GET /admin/users?role=customer ---');
  console.log('status:', customers.status);
  if (customers.status === 200) {
    const users = Array.isArray(customers.data) ? customers.data : customers.data?.users;
    console.log('count:', users?.length ?? 0);
  }

  const search = await getUsers(token, '?search=test');
  console.log('\n--- GET /admin/users?search=test ---');
  console.log('status:', search.status);
  if (search.status === 200) {
    const users = Array.isArray(search.data) ? search.data : search.data?.users;
    console.log('count:', users?.length ?? 0);
  }
}

main().catch((e) => {
  console.error('VERIFY_FAILED', e.message);
  process.exit(1);
});
