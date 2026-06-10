/**
 * Simulates post-OAuth session flow using admin login (JWT + cookie path).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { requireAdminCreds } = require('./lib/requireAdminCreds');
const API = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');
const FE = process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app';

async function authMe(headers) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { ...headers, Origin: FE },
    credentials: 'include'
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const { email, password } = requireAdminCreds();
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: FE },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const login = await loginRes.json();
  const setCookie = loginRes.headers.get('set-cookie') || '';
  const cookie = (setCookie.match(/auth_token=[^;]+/) || [])[0] || '';

  const steps = [];

  const bearer1 = await authMe({ Authorization: `Bearer ${login.token}` });
  steps.push({ step: 'auth/me after login (Bearer)', status: bearer1.status, pass: bearer1.status === 200 });

  const cookie1 = await authMe({ Cookie: cookie });
  steps.push({ step: 'auth/me after login (cookie)', status: cookie1.status, pass: cookie1.status === 200 });

  const logoutRes = await fetch(`${API}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.token}`, Origin: FE },
    credentials: 'include'
  });
  steps.push({ step: 'logout', status: logoutRes.status, pass: logoutRes.status === 200 });

  const bearer2 = await authMe({ Authorization: `Bearer ${login.token}` });
  steps.push({
    step: 'auth/me after logout (Bearer still sent)',
    status: bearer2.status,
    pass: bearer2.status === 200,
    note: 'JWT remains valid until expiry; client must clear local token'
  });

  const login2Res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: FE },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const login2 = await login2Res.json();
  const bearer3 = await authMe({ Authorization: `Bearer ${login2.token}` });
  steps.push({ step: 're-login auth/me', status: bearer3.status, pass: bearer3.status === 200 });

  const booking = await fetch(`${API}/bookings/my-bookings`, {
    headers: { Authorization: `Bearer ${login2.token}`, Origin: FE },
    credentials: 'include'
  });
  steps.push({ step: 'bookings/my-bookings', status: booking.status, pass: booking.status === 200 });

  const profile = await fetch(`${API}/profiles/me`, {
    headers: { Authorization: `Bearer ${login2.token}`, Origin: FE },
    credentials: 'include'
  });
  steps.push({ step: 'profiles/me', status: profile.status, pass: profile.status === 200 });

  const failed = steps.filter((s) => !s.pass).length;
  console.log(JSON.stringify({ steps, failed, overall: failed === 0 ? 'PASS' : 'FAIL' }, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
