/**
 * Complete end-to-end production verification (API + bundle).
 * Usage: node backend/scripts/e2e_production_verify.js
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com/api';
const API_ROOT = 'https://kolkata-scooty-bike-training.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';

const report = {
  timestamp: new Date().toISOString(),
  deploy: {},
  superAdmin: {},
  subAdmin: {},
  customer: {},
  infrastructure: {},
  failures: [],
  blocked: [],
  authErrors: [],
  networkFailures: []
};

function fail(module, reason, evidence = {}) {
  report.failures.push({ module, reason, evidence });
}

function pass(module, details = {}) {
  return { pass: true, ...details };
}

function failMod(module, reason, evidence = {}) {
  fail(module, reason, evidence);
  return { pass: false, reason, ...evidence };
}

async function req(method, path, { token, body, origin, credentials } = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: credentials ? 'include' : undefined,
      redirect: method === 'GET' && path.includes('/auth/google') ? 'manual' : 'follow'
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if ([401, 403, 404].includes(res.status)) {
      report.authErrors.push({ method, path, status: res.status, errorCode: data?.errorCode });
    }
    return { status: res.status, data, headers: res.headers, raw: text };
  } catch (e) {
    report.networkFailures.push({ method, path, error: e.message });
    return { status: 0, data: null, error: e.message };
  }
}

async function login(email, password) {
  const res = await req('POST', '/auth/login', { body: { email, password }, origin: FE });
  if (res.status !== 200) return null;
  return res.data?.token || null;
}

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function addDays(d, n) {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

async function scanFrontend() {
  const html = await fetch(`${FE}/`).then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const entry = scripts.find((s) => s.includes('main')) || '';
  const main = await fetch(`${FE}${entry.startsWith('/') ? entry : `/${entry}`}`).then((r) => r.text());
  const chunks = new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]));
  const queue = [...chunks];
  const checked = new Set();
  const markers = {
    production: false,
    apiUrl: null,
    staleHost: false,
    oauthTokenCapture: false,
    kolkataToday: false,
    formattedSlotTime: false,
    responsiveCss: false
  };

  while (queue.length) {
    const c = queue.shift();
    if (checked.has(c)) continue;
    checked.add(c);
    const t = await fetch(`${FE}/${c}`).then((r) => r.text()).catch(() => '');
    if (t.startsWith('<!DOCTYPE')) continue;
    if (t.includes('production:!0') || /production:\s*true/.test(t)) markers.production = true;
    const api = t.match(/https:\/\/kolkata-scooty-bike-training\.onrender\.com\/api/);
    if (api) markers.apiUrl = api[0];
    if (t.includes('kolkata-scooty-bike-training-1ild')) markers.staleHost = true;
    if (t.includes("get('token')") || t.includes('get("token")')) markers.oauthTokenCapture = true;
    if (t.includes('getKolkataToday') || t.includes('Asia/Kolkata')) markers.kolkataToday = true;
    if (t.includes('formatted_slot_time') || t.includes('formatDateTime')) markers.formattedSlotTime = true;
    if (t.includes('@media') && (t.includes('320px') || t.includes('max-width') || t.includes('min-width'))) markers.responsiveCss = true;
    for (const m of t.matchAll(/chunk-[A-Z0-9]+\.js/g)) if (!checked.has(m[0])) queue.push(m[0]);
  }
  return { ...markers, chunkCount: checked.size, entry };
}

async function testDeploy() {
  const health = await fetch(`${API_ROOT}/health`).then((r) => r.json()).catch(() => ({}));
  const version = await req('GET', '/version');
  const fe = await scanFrontend();
  const ok = health.status === 'ok' && version.status === 200 && fe.production && fe.apiUrl && !fe.staleHost;
  report.deploy = { health, version: version.data, frontend: fe, pass: ok };
  if (!ok) fail('Deploy', 'Health/version/frontend bundle check failed', { health, version: version.data, fe });
  return ok;
}

async function testSuperAdmin(token) {
  const mods = {};

  const me = await req('GET', '/auth/me', { token });
  mods.login = me.status === 200 ? pass('Login', { email: me.data?.email, role: me.data?.role }) : failMod('Login', `/auth/me ${me.status}`);

  const stats = await req('GET', '/admin/stats', { token });
  const dash = await req('GET', '/admin/dashboard', { token });
  mods.dashboard = stats.status === 200 && dash.status === 200
    ? pass('Dashboard', { stats: stats.status, dashboard: dash.status, keys: Object.keys(stats.data || {}) })
    : failMod('Dashboard', `stats=${stats.status} dashboard=${dash.status}`);

  const users = await req('GET', '/admin/users?limit=10', { token });
  const search = await req('GET', '/admin/users?search=a&limit=5', { token });
  const exportRes = await req('GET', '/admin/customers/export', { token });
  const leaks = (users.data?.users || users.data || []).filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
  mods.users = users.status === 200 && search.status === 200 && exportRes.status === 200 && leaks.length === 0
    ? pass('Users', { total: users.data?.total, leaks: 0 })
    : failMod('Users', `status/export/leaks`, { users: users.status, search: search.status, export: exportRes.status, leaks: leaks.length });

  const trainers = await req('GET', '/admin/trainers', { token });
  const tCreate = await req('POST', '/admin/trainers', { token, body: { name: `E2E T ${Date.now()}`, phone: '9876501234', email: `e2e-${Date.now()}@test.invalid`, is_active: true } });
  let tPass = trainers.status === 200 && (tCreate.status === 200 || tCreate.status === 201);
  if (tCreate.data?.id) await req('DELETE', `/admin/trainers/${tCreate.data.id}`, { token });
  mods.trainers = tPass ? pass('Trainers CRUD', { list: trainers.status, create: tCreate.status }) : failMod('Trainers CRUD', `list=${trainers.status} create=${tCreate.status}`);

  const vehicles = await req('GET', '/vehicles?include_inactive=true', { token });
  const vCreate = await req('POST', '/vehicles', { token, body: { name: `E2E V ${Date.now()}`, max_per_slot: 1, is_active: false } });
  let vPass = vehicles.status === 200 && (vCreate.status === 200 || vCreate.status === 201);
  if (vCreate.data?.id) await req('DELETE', `/vehicles/${vCreate.data.id}`, { token });
  mods.vehicles = vPass ? pass('Vehicles CRUD', { list: vehicles.status, create: vCreate.status }) : failMod('Vehicles CRUD', `list=${vehicles.status} create=${vCreate.status}`);

  const today = kolkataToday();
  const tomorrow = addDays(today, 1);
  const slotsToday = await req('GET', `/slots/date/${today}?bookable_only=true`);
  const slotsTomorrow = await req('GET', `/slots/date/${tomorrow}?bookable_only=true`);
  const allTomorrow = await req('GET', `/slots/date/${tomorrow}`);
  const noTrainer = (allTomorrow.data || []).filter((s) => !s.trainer_id).length;
  mods.slots = slotsTomorrow.status === 200
    ? pass('Slots', { todayBookable: (slotsToday.data || []).length, tomorrowBookable: (slotsTomorrow.data || []).length, orphanTrainers: noTrainer })
    : failMod('Slots', `status ${slotsTomorrow.status}`);

  const active = (vehicles.data || []).filter((v) => v.is_active !== false);
  const expectedCap = active.reduce((s, v) => s + (Number(v.max_per_slot) || 0), 0);
  const sampleCap = (slotsTomorrow.data || [])[0]?.capacity;
  const recalc = await req('POST', '/admin/slots/recalculate-capacity', { token, body: {} });
  const afterSlots = await req('GET', `/slots/date/${tomorrow}?bookable_only=true`);
  const capAfter = (afterSlots.data || [])[0]?.capacity;
  mods.slotCapacity = capAfter === Math.max(1, expectedCap) && recalc.status === 200
    ? pass('Slot Capacity', { expected: Math.max(1, expectedCap), actual: capAfter, recalc: recalc.status, vehicles: active.map((v) => `${v.name}:${v.max_per_slot}`) })
    : failMod('Slot Capacity', `expected ${Math.max(1, expectedCap)}, got ${capAfter}, recalc=${recalc.status}`, { recalcError: recalc.data, sampleBefore: sampleCap });

  const bookings = await req('GET', '/admin/bookings?limit=5', { token });
  const searchB = await req('GET', '/admin/bookings?search=test&limit=5', { token });
  const overdue = await req('GET', '/admin/bookings/overdue', { token });
  const hasFormatted = (bookings.data?.bookings || [])[0]?.formatted_slot_time;
  mods.bookings = bookings.status === 200 && searchB.status === 200
    ? pass('Bookings', { total: bookings.data?.total, overdue: overdue.status, formattedSlotTime: !!hasFormatted })
    : failMod('Bookings', `list=${bookings.status} search=${searchB.status}`);

  const notifs = await req('GET', '/admin/notifications?limit=5', { token });
  const unread = await req('GET', '/admin/notifications/unread-count', { token });
  const markAll = await req('PUT', '/admin/notifications/read-all', { token });
  mods.notifications = notifs.status === 200 && unread.status === 200 && markAll.status === 200
    ? pass('Notifications', { count: (notifs.data || []).length, markAll: markAll.status })
    : failMod('Notifications', `list=${notifs.status} unread=${unread.status}`);

  const settings = await req('GET', '/admin/settings', { token });
  const settingsPut = settings.status === 200 ? await req('PUT', '/admin/settings', { token, body: settings.data }) : { status: 0 };
  mods.settings = settings.status === 200 && settingsPut.status === 200
    ? pass('Settings', { keys: Object.keys(settings.data || {}) })
    : failMod('Settings', `get=${settings.status} put=${settingsPut.status}`);

  const audit = await req('GET', '/admin/audit-logs?limit=10', { token });
  mods.auditLogs = audit.status === 200 ? pass('Audit Logs', { count: (audit.data?.logs || audit.data || []).length }) : failMod('Audit Logs', `status ${audit.status}`);

  const subAdmins = await req('GET', '/admin/sub-admins', { token });
  mods.subAdmins = subAdmins.status === 200 ? pass('Sub Admin CRUD', { count: (subAdmins.data || []).length }) : failMod('Sub Admin CRUD', `status ${subAdmins.status}`);

  report.superAdmin = mods;
  return Object.values(mods).every((m) => m.pass);
}

async function testSubAdmin() {
  const { requireAdminCreds } = require('./lib/requireAdminCreds');
  const { email, password } = requireAdminCreds();
  const list = await req('GET', '/admin/sub-admins', { token: await login(email, password) });
  const subs = Array.isArray(list.data) ? list.data : [];
  if (list.status !== 200 || subs.length === 0) {
    report.subAdmin = { pass: false, reason: 'No sub-admin accounts to test', listStatus: list.status, count: subs.length };
    report.blocked.push('Sub Admin login/RBAC — no sub-admin credentials or accounts in production');
    return false;
  }

  report.subAdmin = {
    pass: false,
    reason: 'Sub-admin password not available for automated login',
    subAdminCount: subs.length,
    sampleEmail: subs[0]?.email,
    blocked: ['Login', 'Module permissions', 'Restricted access validation require sub-admin password']
  };
  report.blocked.push('Sub Admin flows — provide test credentials or reset password for automated E2E');
  return false;
}

async function testCustomer(token) {
  const mods = {};
  const oauth = await req('GET', '/auth/google', { origin: FE });
  const loc = oauth.headers?.get?.('location') || '';
  const redirectUri = decodeURIComponent((loc.match(/redirect_uri=([^&]+)/) || [])[1] || '');
  mods.googleOAuth = redirectUri.includes('kolkata-scooty-bike-training.onrender.com/api/auth/google/callback')
    ? pass('Google OAuth', { redirectUri })
    : failMod('Google OAuth', `bad redirect_uri: ${redirectUri}`);

  const me = await req('GET', '/auth/me', { token, origin: FE, credentials: true });
  mods.authMe = me.status === 200 ? pass('Auth /me', { status: me.status }) : failMod('Auth /me', `status ${me.status}`);

  const profile = await req('GET', '/profiles/me', { token });
  mods.profile = profile.status === 200 ? pass('Profile', { email: profile.data?.email }) : failMod('Profile', `status ${profile.status}`);

  const today = kolkataToday();
  const tomorrow = addDays(today, 1);
  const bookable = await req('GET', `/slots/date/${tomorrow}?bookable_only=true`);
  mods.bookingPage = (bookable.data || []).length > 0
    ? pass('Booking page slots', { date: tomorrow, count: bookable.data.length, sampleCapacity: bookable.data[0]?.capacity })
    : failMod('Booking page slots', `0 bookable slots for ${tomorrow}`);

  const myBookings = await req('GET', '/bookings/my-bookings', { token });
  const sample = (myBookings.data || [])[0];
  mods.myBookings = myBookings.status === 200
    ? pass('My Bookings', { count: (myBookings.data || []).length, hasStartTime: !!sample?.start_time, hasFormatted: !!sample?.formatted_slot_time })
    : failMod('My Bookings', `status ${myBookings.status}`);

  mods.bookingCreate = { pass: null, blocked: 'Requires authenticated customer + available slot — manual browser test' };
  mods.reschedule = { pass: null, blocked: 'Requires existing customer booking — manual' };
  mods.cancel = { pass: null, blocked: 'Requires existing customer booking — manual' };
  report.blocked.push('Customer booking create/reschedule/cancel — manual browser with Google OAuth customer');

  report.customer = mods;
  const testable = [mods.googleOAuth, mods.authMe, mods.profile, mods.bookingPage, mods.myBookings];
  return testable.every((m) => m.pass);
}

async function testInfrastructure() {
  const cors = await req('GET', '/auth/me', { origin: FE });
  const corsOk = cors.headers?.get?.('access-control-allow-origin') === FE;
  const vehicles = await req('GET', '/vehicles');
  const active = (vehicles.data || []).filter((v) => v.is_active !== false);
  const expectedCap = active.reduce((s, v) => s + (Number(v.max_per_slot) || 0), 0);
  const tomorrow = addDays(kolkataToday(), 1);
  const slots = await req('GET', `/slots/date/${tomorrow}?bookable_only=true`);
  const cap = (slots.data || [])[0]?.capacity;
  const trainerOk = (slots.data || []).every((s) => !!s.trainer_id);

  report.infrastructure = {
    cors: corsOk ? pass('CORS', { origin: FE }) : failMod('CORS', 'credentials/origin mismatch'),
    capacityFormula: cap === Math.max(1, expectedCap) ? pass('Capacity SUM', { expected: expectedCap, actual: cap }) : failMod('Capacity SUM', `expected ${expectedCap}, got ${cap}`),
    trainerAssignment: trainerOk ? pass('Trainer assignment', { slots: (slots.data || []).length }) : failMod('Trainer assignment', 'slots missing trainer_id'),
    authErrors: report.authErrors.length,
    networkFailures: report.networkFailures.length
  };
  return Object.values(report.infrastructure).filter((v) => v && typeof v === 'object' && 'pass' in v).every((v) => v.pass);
}

function scoreReport() {
  const all = [
    ...Object.values(report.superAdmin),
    ...Object.values(report.customer || {}),
    ...Object.values(report.infrastructure || {})
  ].filter((m) => m && typeof m === 'object' && m.pass !== null && m.pass !== undefined);

  const passed = all.filter((m) => m.pass === true).length;
  const failed = all.filter((m) => m.pass === false).length;
  const total = passed + failed;
  const pct = total ? Math.round((passed / total) * 100) : 0;
  const overallPass = failed === 0 && report.deploy?.pass && report.networkFailures.length === 0;
  return { passed, failed, total, pct, overallPass };
}

async function main() {
  console.log('=== E2E Production Verification ===\n');

  const { requireAdminCreds } = require('./lib/requireAdminCreds');
  const { email, password } = requireAdminCreds();

  await testDeploy();
  const token = await login(email, password);
  if (!token) {
    fail('Auth', 'Super admin login failed — rate limit or bad credentials');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  await testSuperAdmin(token);
  await testSubAdmin();
  await testCustomer(token);
  await testInfrastructure();

  const score = scoreReport();
  report.score = score;
  report.goNoGo = score.overallPass && score.pct >= 90 ? 'GO' : score.pct >= 75 ? 'CONDITIONAL GO' : 'NO-GO';
  report.screenshots = 'NOT CAPTURED — API/bundle verification only; browser screenshots require manual QA';

  console.log(JSON.stringify(report, null, 2));
  console.log(`\n=== READINESS: ${score.pct}% | ${report.goNoGo} ===`);
  console.log(`PASS: ${score.passed} | FAIL: ${score.failed} | BLOCKED: ${report.blocked.length}`);
  process.exit(score.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
