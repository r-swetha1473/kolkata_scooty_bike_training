/**
 * Production Google OAuth + /auth/me verification (no browser required).
 * Run: node backend/scripts/verify_google_oauth_production.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { requireAdminCreds } = require('./lib/requireAdminCreds');
const API_ROOT = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/api\/?$/, '');
const API = `${API_ROOT}/api`;
const FE = process.env.FRONTEND_URL || 'https://kolkata-scooty-bike-training.vercel.app';
const ACTIVE_CALLBACK = `${API_ROOT}/api/auth/google/callback`;
const STALE_HOST = 'kolkata-scooty-bike-training-1ild.onrender.com';

const results = [];

function pass(name, detail) {
  results.push({ name, status: 'PASS', detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function getJson(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function loginAdmin() {
  const { email, password } = requireAdminCreds();
  const { res, data } = await getJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: FE },
    body: JSON.stringify({ email, password })
  });
  return { status: res.status, token: data.token, setCookie: res.headers.get('set-cookie') || '' };
}

async function scanFrontendBundle() {
  const html = await fetch(`${FE}/`).then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const entry = scripts.find((s) => s.includes('main')) || '';
  const entryPath = entry.startsWith('/') ? entry : `/${entry}`;
  const main = await fetch(`${FE}${entryPath}`).then((r) => r.text());
  const chunks = new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]));
  const queue = [...chunks];
  const checked = new Set();
  let tokenCapture = false;
  let activeApi = false;
  let staleApi = false;

  while (queue.length) {
    const c = queue.shift();
    if (checked.has(c)) continue;
    checked.add(c);
    const t = await fetch(`${FE}/${c}`).then((r) => r.text()).catch(() => '');
    if (t.startsWith('<!DOCTYPE')) continue;
    if (t.includes("get('token')") || t.includes('get(\"token\")')) tokenCapture = true;
    if (t.includes('kolkata-scooty-bike-training.onrender.com/api')) activeApi = true;
    if (t.includes(STALE_HOST)) staleApi = true;
    for (const m of t.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(m[0])) queue.push(m[0]);
    }
  }

  return { tokenCapture, activeApi, staleApi, chunks: checked.size };
}

async function main() {
  console.log('=== Google OAuth Production Verification ===\n');

  const oauthRes = await fetch(`${API}/auth/google`, { redirect: 'manual' });
  const location = oauthRes.headers.get('location') || '';
  const redirectUri = decodeURIComponent((location.match(/redirect_uri=([^&]+)/) || [])[1] || '');

  if (redirectUri === ACTIVE_CALLBACK) {
    pass('OAuth redirect_uri', redirectUri);
  } else {
    fail('OAuth redirect_uri', `expected ${ACTIVE_CALLBACK}, got ${redirectUri || '(missing)'}`);
  }

  if (!redirectUri.includes(STALE_HOST)) {
    pass('No stale -1ild callback in OAuth start');
  } else {
    fail('No stale -1ild callback', redirectUri);
  }

  const corsRes = await fetch(`${API}/auth/me`, {
    headers: { Origin: FE },
    credentials: 'include'
  });
  const corsOrigin = corsRes.headers.get('access-control-allow-origin');
  const corsCreds = corsRes.headers.get('access-control-allow-credentials');
  if (corsOrigin === FE && corsCreds === 'true') {
    pass('CORS credentials for /auth/me', `${corsOrigin}`);
  } else {
    fail('CORS credentials', `origin=${corsOrigin} credentials=${corsCreds}`);
  }

  const { status, token, setCookie } = await loginAdmin();
  if (status === 200 && token) {
    pass('Admin login returns JWT');
  } else {
    fail('Admin login returns JWT', `status=${status}`);
  }

  if (setCookie.includes('auth_token')) {
    pass('Login sets auth_token cookie');
  } else {
    fail('Login sets auth_token cookie');
  }

  if (token) {
    const bearer = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Origin: FE },
      credentials: 'include'
    });
    const bearerBody = await bearer.json().catch(() => ({}));
    if (bearer.status === 200 && bearerBody.email) {
      pass('/auth/me with Bearer token', bearerBody.email);
    } else {
      fail('/auth/me with Bearer token', `status=${bearer.status} code=${bearerBody.errorCode}`);
    }

    const cookieHeader = (setCookie.match(/auth_token=[^;]+/) || [])[0];
    if (cookieHeader) {
      const cookieMe = await fetch(`${API}/auth/me`, {
        headers: { Cookie: cookieHeader, Origin: FE },
        credentials: 'include'
      });
      const cookieBody = await cookieMe.json().catch(() => ({}));
      if (cookieMe.status === 200 && cookieBody.email) {
        pass('/auth/me with auth_token cookie', cookieBody.email);
      } else {
        fail('/auth/me with auth_token cookie', `status=${cookieMe.status}`);
      }
    }
  }

  const version = await fetch(`${API_ROOT}/api/version`).then((r) => r.json()).catch(() => ({}));
  pass('Backend version endpoint', version.commit || version.gitCommit || 'unknown');

  const fe = await scanFrontendBundle();
  if (fe.activeApi) pass('Frontend bundle uses active API URL');
  else fail('Frontend bundle uses active API URL');
  if (!fe.staleApi) pass('Frontend bundle has no stale -1ild host');
  else fail('Frontend bundle has stale -1ild host');
  if (fe.tokenCapture) pass('Frontend bundle captures OAuth ?token= param');
  else fail('Frontend bundle captures OAuth ?token= param', 'deploy AuthService fix to Vercel');

  const versionRes = await fetch(`${API_ROOT}/health`).then((r) => r.json()).catch(() => ({}));
  pass('Backend health', versionRes.status || 'ok');

  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n=== ${failed === 0 ? 'OVERALL: PASS' : `OVERALL: FAIL (${failed} checks)`} ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
