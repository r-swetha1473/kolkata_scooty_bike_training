/**
 * Full production QA audit — authenticated API + frontend bundle checks.
 * Usage: node backend/scripts/production_qa_audit.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = (process.env.API_BASE || 'https://kolkata-scooty-bike-training.onrender.com/api').replace(/\/$/, '');
const API_ROOT = API_BASE.replace(/\/api$/, '');
const FE = process.env.FE_URL || 'https://kolkata-scooty-bike-training.vercel.app';
const { requireAdminCreds } = require('./lib/requireAdminCreds');
const { email: EMAIL, password: PASSWORD } = requireAdminCreds();

const report = {
  timestamp: new Date().toISOString(),
  apiBase: API_BASE,
  frontend: FE,
  modules: {},
  bugs: [],
  blocked: [],
  networkFailures: [],
  authErrors: []
};

function bug(module, severity, message, files = []) {
  report.bugs.push({ module, severity, message, files });
}

function setModule(name, pass, details = {}) {
  report.modules[name] = { pass, ...details };
}

async function req(method, path, { token, body, qs } = {}) {
  const url = `${API_BASE}${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    report.networkFailures.push({ method, path, error: e.message });
    return { status: 0, data: null, error: e.message };
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (res.status === 401 || res.status === 403) {
    report.authErrors.push({ method, path, status: res.status });
  }
  return { status: res.status, data, raw: text };
}

async function login() {
  const res = await req('POST', '/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`Login failed ${res.status}: ${JSON.stringify(res.data)}`);
  return res.data.token || res.data.accessToken;
}

async function testDashboard(token) {
  const checks = {};
  const stats = await req('GET', '/admin/stats', { token });
  checks.stats = stats.status;
  const dash = await req('GET', '/admin/dashboard', { token });
  checks.dashboard = dash.status;
  const unread = await req('GET', '/admin/notifications/unread-count', { token });
  checks.unreadCount = unread.status;
  const notifs = await req('GET', '/admin/notifications', { token });
  checks.notifications = notifs.status;

  const fail =
    stats.status !== 200 ||
    dash.status !== 200 ||
    unread.status !== 200 ||
    notifs.status !== 200;

  if (stats.status !== 200) bug('Dashboard', 'Critical', `GET /admin/stats → ${stats.status}`, ['backend/routes/admin.js']);
  if (unread.status !== 200) bug('Dashboard', 'High', `GET /admin/notifications/unread-count → ${unread.status}`, ['backend/routes/admin.js']);

  const statsShape = stats.data && typeof stats.data === 'object';
  setModule('Dashboard', !fail && statsShape, {
    endpoints: checks,
    statsKeys: statsShape ? Object.keys(stats.data) : [],
    unreadCount: unread.data?.count ?? unread.data?.unread_count ?? unread.data
  });
}

async function testUsers(token) {
  const all = await req('GET', '/admin/users', { token });
  const search = await req('GET', '/admin/users', { token, qs: 'search=a' });
  const roleFilter = await req('GET', '/admin/users', { token, qs: 'role=customer' });
  const exportRes = await req('GET', '/admin/customers/export', { token });

  const users = Array.isArray(all.data) ? all.data : all.data?.users;
  const googleLeaks = (users || []).filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));

  if (all.status !== 200) bug('Users', 'Critical', `GET /admin/users → ${all.status}`, ['backend/utils/adminUsersQuery.js', 'backend/routes/admin.js']);
  if (search.status !== 200) bug('Users', 'High', `Search filter failed → ${search.status}`, ['src/app/admin/pages/users/users.component.ts']);
  if (roleFilter.status !== 200) bug('Users', 'High', `Role filter failed → ${roleFilter.status}`, ['src/app/admin/pages/users/users.component.ts']);
  if (exportRes.status !== 200) bug('Users', 'Medium', `Export failed → ${exportRes.status}`, ['backend/routes/admin.js']);
  if (googleLeaks.length > 0) {
    bug('Users', 'High', `${googleLeaks.length} users still expose GOOGLE_* phone values`, ['backend/utils/userPhone.js', 'src/app/utils/phone-display.ts']);
  }

  const pass =
    all.status === 200 &&
    search.status === 200 &&
    roleFilter.status === 200 &&
    exportRes.status === 200 &&
    googleLeaks.length === 0 &&
    (users?.length ?? 0) > 0;

  setModule('Users', pass, {
    total: all.data?.total ?? users?.length ?? 0,
    searchCount: (Array.isArray(search.data) ? search.data : search.data?.users)?.length ?? 0,
    roleFilterCount: (Array.isArray(roleFilter.data) ? roleFilter.data : roleFilter.data?.users)?.length ?? 0,
    exportStatus: exportRes.status,
    googleLeaks: googleLeaks.length,
    samplePhone: users?.[0]?.phone,
    phoneSource: users?.[0]?.phone_source
  });
}

async function testTrainers(token) {
  const list = await req('GET', '/admin/trainers', { token });
  const trainers = Array.isArray(list.data) ? list.data : list.data?.trainers ?? list.data?.data ?? [];

  let createOk = false;
  let editOk = false;
  let deleteOk = false;
  let toggleOk = false;
  let testId = null;

  if (list.status === 200) {
    const name = `QA Trainer ${Date.now()}`;
    const created = await req('POST', '/admin/trainers', {
      token,
      body: { name, phone: '9876543210', email: `qa-${Date.now()}@test.invalid`, is_active: true }
    });
    createOk = created.status === 200 || created.status === 201;
    testId = created.data?.id || created.data?.trainer?.id;

    if (!createOk) {
      bug('Trainers', 'High', `Create trainer failed → ${created.status}: ${JSON.stringify(created.data).slice(0, 200)}`, ['backend/routes/admin.js']);
    } else if (testId) {
      const toggled = await req('PUT', `/admin/trainers/${testId}`, {
        token,
        body: { is_active: false }
      });
      toggleOk = toggled.status === 200;
      if (!toggleOk) bug('Trainers', 'Medium', `Status toggle failed → ${toggled.status}`, ['backend/routes/admin.js']);

      const edited = await req('PUT', `/admin/trainers/${testId}`, {
        token,
        body: { name: name + ' Edited', is_active: true }
      });
      editOk = edited.status === 200;
      if (!editOk) bug('Trainers', 'Medium', `Edit trainer failed → ${edited.status}`, ['backend/routes/admin.js']);

      const deleted = await req('DELETE', `/admin/trainers/${testId}`, { token });
      deleteOk = deleted.status === 200 || deleted.status === 204;
      if (!deleteOk) bug('Trainers', 'Medium', `Delete trainer failed → ${deleted.status}`, ['backend/routes/admin.js']);
    }
  } else {
    bug('Trainers', 'Critical', `GET /admin/trainers → ${list.status}`, ['backend/routes/admin.js']);
  }

  setModule('Trainers', list.status === 200 && createOk && editOk && deleteOk, {
    listStatus: list.status,
    count: trainers.length,
    createOk,
    editOk,
    deleteOk,
    toggleOk,
    mobileUi: 'BLOCKED — requires browser DevTools'
  });
  report.blocked.push('Trainers mobile responsiveness — manual browser check');
}

async function testVehicles(token) {
  const list = await req('GET', '/vehicles', { token });
  const vehicles = Array.isArray(list.data) ? list.data : list.data?.vehicles ?? [];
  const activeCount = vehicles.filter((v) => v.is_active !== false).length;

  let createOk = false;
  let editOk = false;
  let deleteOk = false;
  let testId = null;

  if (list.status === 200) {
    const created = await req('POST', '/vehicles', {
      token,
      body: { name: `QA Vehicle ${Date.now()}`, max_per_slot: 1, is_active: false }
    });
    createOk = created.status === 200 || created.status === 201;
    testId = created.data?.id;

    if (testId) {
      const edited = await req('PUT', `/vehicles/${testId}`, {
        token,
        body: { name: created.data?.name, max_per_slot: 2, is_active: true }
      });
      editOk = edited.status === 200;

      const deactivated = await req('PUT', `/vehicles/${testId}`, {
        token,
        body: { is_active: false }
      });
      const inactiveOk = deactivated.status === 200;

      const deleted = await req('DELETE', `/vehicles/${testId}`, { token });
      deleteOk = deleted.status === 200 || deleted.status === 204;

      if (!editOk) bug('Vehicles', 'Medium', `Edit vehicle failed → ${edited.status}`, ['backend/routes/vehicles.js']);
      if (!inactiveOk) bug('Vehicles', 'Medium', `Inactive toggle failed → ${deactivated.status}`, ['backend/routes/vehicles.js']);
      if (!deleteOk) bug('Vehicles', 'Medium', `Delete vehicle failed → ${deleted.status}`, ['backend/routes/vehicles.js']);
    } else if (!createOk) {
      bug('Vehicles', 'High', `Create vehicle failed → ${created.status}`, ['backend/routes/vehicles.js']);
    }
  } else {
    bug('Vehicles', 'Critical', `GET /vehicles → ${list.status}`, ['backend/routes/vehicles.js']);
  }

  const slotsBefore = await req('GET', '/slots/available');
  const slots = Array.isArray(slotsBefore.data?.slots) ? slotsBefore.data.slots : Array.isArray(slotsBefore.data) ? slotsBefore.data : [];
  const capacities = [...new Set(slots.map((s) => s.capacity))];
  const capacitySync = capacities.length === 1 && capacities[0] === Math.max(1, activeCount);

  if (!capacitySync) {
    bug('Vehicles', 'High', `Slot capacity mismatch: ${activeCount} active vehicles, slot capacities: ${capacities.join(',')}`, ['backend/services/slotCapacity.service.js']);
  }

  setModule('Vehicles', list.status === 200 && createOk && editOk && deleteOk && capacitySync, {
    count: vehicles.length,
    activeCount,
    createOk,
    editOk,
    deleteOk,
    capacitySync,
    slotCapacities: capacities
  });
}

async function testSlots(token) {
  const available = await req('GET', '/slots/available');
  const slots = Array.isArray(available.data?.slots) ? available.data.slots : Array.isArray(available.data) ? available.data : [];

  const vehicles = await req('GET', '/vehicles');
  const activeVehicles = (Array.isArray(vehicles.data) ? vehicles.data : []).filter((v) => v.is_active !== false);
  const expected = Math.max(1, activeVehicles.length);
  const capacities = [...new Set(slots.map((s) => s.capacity))];
  const capacityMatch = capacities.length === 1 && capacities[0] === expected;

  const recalc = await req('POST', '/admin/slots/recalculate-capacity', { token, body: {} });
  const recalcOk = recalc.status === 200;

  const after = await req('GET', '/slots/available');
  const slotsAfter = Array.isArray(after.data?.slots) ? after.data.slots : Array.isArray(after.data) ? after.data : [];
  const capacitiesAfter = [...new Set(slotsAfter.map((s) => s.capacity))];
  const afterMatch = capacitiesAfter.length === 1 && capacitiesAfter[0] === expected;

  if (available.status !== 200) bug('Slots', 'Critical', `GET /slots/available → ${available.status}`, ['backend/routes/slots.js']);
  if (!recalcOk) bug('Slots', 'High', `Recalculate capacity → ${recalc.status}`, ['backend/routes/admin.js', 'backend/services/slotCapacity.service.js']);
  if (!capacityMatch) bug('Slots', 'High', `Capacity before recalc: expected ${expected}, got ${capacities.join(',')}`, ['backend/services/slotCapacity.service.js']);
  if (!afterMatch) bug('Slots', 'High', `Capacity after recalc: expected ${expected}, got ${capacitiesAfter.join(',')}`, ['backend/services/slotCapacity.service.js']);

  setModule('Slots', available.status === 200 && recalcOk && afterMatch, {
    slotCount: slots.length,
    activeVehicles: activeVehicles.length,
    expectedCapacity: expected,
    capacitiesBefore: capacities,
    capacitiesAfter: capacitiesAfter,
    recalcStatus: recalc.status,
    recalcMessage: recalc.data?.message
  });
}

async function testBookings(token) {
  const page1 = await req('GET', '/admin/bookings', { token, qs: 'limit=10&offset=0' });
  const page2 = await req('GET', '/admin/bookings', { token, qs: 'limit=10&offset=10' });
  const search = await req('GET', '/admin/bookings', { token, qs: 'search=test&limit=5' });
  const overdue = await req('GET', '/admin/bookings/overdue', { token });

  const bookings1 = Array.isArray(page1.data) ? page1.data : page1.data?.bookings ?? [];
  const total = page1.data?.total ?? bookings1.length;

  if (page1.status !== 200) bug('Bookings', 'Critical', `GET /admin/bookings → ${page1.status}`, ['backend/routes/admin.js']);
  if (search.status !== 200) bug('Bookings', 'High', `Booking search failed → ${search.status}`, ['backend/utils/bookingSearch.js']);
  if (overdue.status !== 200) bug('Bookings', 'Medium', `Overdue bookings failed → ${overdue.status}`, ['backend/routes/admin.js']);

  setModule('Bookings', page1.status === 200 && search.status === 200 && overdue.status === 200, {
    total,
    page1Count: bookings1.length,
    page2Status: page2.status,
    searchStatus: search.status,
    overdueStatus: overdue.status,
    overdueCount: Array.isArray(overdue.data) ? overdue.data.length : overdue.data?.bookings?.length ?? overdue.data?.count,
    statusUpdate: 'SKIPPED — no mutation on prod booking',
    mobileUi: 'BLOCKED — requires browser'
  });
  report.blocked.push('Bookings status update + mobile layout — manual browser check');
}

async function testNotifications(token) {
  const unread = await req('GET', '/admin/notifications/unread-count', { token });
  const list = await req('GET', '/admin/notifications', { token });
  const notifs = Array.isArray(list.data) ? list.data : list.data?.notifications ?? [];

  let markReadOk = true;
  let markAllOk = true;

  if (notifs.length > 0) {
    const firstId = notifs[0].id;
    const markOne = await req('PUT', `/admin/notifications/${firstId}/read`, { token });
    markReadOk = markOne.status === 200;
    if (!markReadOk) bug('Notifications', 'Medium', `Mark read failed → ${markOne.status}`, ['backend/routes/admin.js']);
  }

  const markAll = await req('PUT', '/admin/notifications/read-all', { token });
  markAllOk = markAll.status === 200;
  if (!markAllOk) bug('Notifications', 'Medium', `Mark all read failed → ${markAll.status}`, ['backend/routes/admin.js']);

  const unreadAfter = await req('GET', '/admin/notifications/unread-count', { token });
  const countAfter = unreadAfter.data?.count ?? unreadAfter.data?.unread_count ?? 0;

  setModule('Notifications', unread.status === 200 && list.status === 200 && markAllOk, {
    unreadStatus: unread.status,
    listStatus: list.status,
    notificationCount: notifs.length,
    markReadOk: notifs.length > 0 ? markReadOk : 'N/A',
    markAllOk,
    unreadAfter: countAfter,
    bellDropdown: 'BLOCKED — requires browser'
  });
  report.blocked.push('Notifications bell dropdown UI — manual browser check');
}

async function testSubAdmins(token) {
  const list = await req('GET', '/admin/sub-admins', { token });
  const admins = await req('GET', '/admin/admins', { token });

  const subAdmins = Array.isArray(list.data) ? list.data : list.data?.sub_admins ?? list.data?.data ?? [];
  const pass = list.status === 200 && admins.status === 200;

  if (list.status === 404) bug('Sub Admins', 'Critical', 'GET /admin/sub-admins returns 404', ['backend/routes/admin.js', 'backend/server.js']);
  if (list.status === 403) bug('Sub Admins', 'High', 'GET /admin/sub-admins forbidden — RBAC issue', ['backend/middleware/auth.js']);
  if (list.status !== 200 && list.status !== 403) bug('Sub Admins', 'High', `GET /admin/sub-admins → ${list.status}`, ['backend/routes/admin.js']);

  setModule('Sub Admins', pass, {
    subAdminsStatus: list.status,
    adminsStatus: admins.status,
    subAdminCount: subAdmins.length,
    createModal: 'BLOCKED — browser UI',
    editModal: 'BLOCKED — browser UI',
    deleteModal: 'BLOCKED — browser UI',
    resetPassword: 'BLOCKED — browser UI',
    permissionMatrix: 'BLOCKED — browser UI',
    escClose: 'BLOCKED — browser UI',
    focusTrap: 'BLOCKED — browser UI',
    mobileUi: 'BLOCKED — browser UI'
  });
  report.blocked.push('Sub Admins modal UX (ESC, focus trap, mobile) — verify in browser; may need deploy if polish uncommitted');
}

async function testSettings(token) {
  const get = await req('GET', '/admin/settings', { token });
  const settings = get.data;

  let saveOk = false;
  if (get.status === 200 && settings) {
    const put = await req('PUT', '/admin/settings', { token, body: settings });
    saveOk = put.status === 200;
    if (!saveOk) bug('Settings', 'Medium', `Save settings failed → ${put.status}`, ['backend/routes/admin.js', 'src/app/admin/pages/settings/settings.component.ts']);
  } else {
    bug('Settings', 'High', `GET /admin/settings → ${get.status}`, ['backend/routes/admin.js']);
  }

  const recalc = await req('POST', '/admin/slots/recalculate-capacity', { token, body: {} });
  const recalcOk = recalc.status === 200;

  setModule('Settings', get.status === 200 && saveOk && recalcOk, {
    getStatus: get.status,
    saveOk,
    recalcStatus: recalc.status,
    settingsKeys: settings ? Object.keys(settings) : []
  });
}

async function testAuditLogs(token) {
  const page1 = await req('GET', '/admin/audit-logs', { token, qs: 'limit=20&offset=0' });
  const page2 = await req('GET', '/admin/audit-logs', { token, qs: 'limit=20&offset=20' });
  const filtered = await req('GET', '/admin/audit-logs', { token, qs: 'action=LOGIN&limit=10' });

  const logs = Array.isArray(page1.data) ? page1.data : page1.data?.logs ?? page1.data?.audit_logs ?? [];

  if (page1.status !== 200) bug('Audit Logs', 'High', `GET /admin/audit-logs → ${page1.status}`, ['backend/routes/admin.js']);
  if (filtered.status !== 200) bug('Audit Logs', 'Medium', `Audit log filter failed → ${filtered.status}`, ['backend/routes/admin.js']);

  setModule('Audit Logs', page1.status === 200 && page2.status === 200 && filtered.status === 200, {
    page1Status: page1.status,
    page2Status: page2.status,
    filterStatus: filtered.status,
    logCount: logs.length,
    total: page1.data?.total
  });
}

async function testFrontendBundle() {
  const checks = { productionFlag: null, apiUrl: null, subAdminPolish: false, usersPhoneFix: false };

  const mainRes = await fetch(`${FE}/main.js`);
  const mainJs = await mainRes.text();
  const chunkRefs = [...new Set([...mainJs.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];

  for (const chunk of chunkRefs) {
    const txt = await fetch(`${FE}/${chunk}`).then((r) => r.text()).catch(() => '');
    if (checks.productionFlag == null) {
      const m = txt.match(/production:\s*(true|false)/);
      if (m) checks.productionFlag = m[1] === 'true';
    }
    if (!checks.apiUrl) {
      const m = txt.match(/https:\/\/[^"']+onrender\.com\/api/);
      if (m) checks.apiUrl = m[0];
    }
    if (txt.includes('account-modal') || txt.includes('trapFocusInModal') || txt.includes('accountModalPanel')) {
      checks.subAdminPolish = true;
    }
    if (txt.includes('formatUserPhoneDisplay') || txt.includes('Not Provided')) {
      checks.usersPhoneFix = true;
    }
  }

  const health = await fetch(`${API_ROOT}/health`).then((r) => r.json()).catch(() => ({}));
  const version = await fetch(`${API_ROOT}/api/version`).then((r) => ({ status: r.status, data: r.json().catch(() => null) }));
  const versionData = await version.data;

  if (checks.productionFlag === false) {
    bug('Frontend', 'Critical', 'Deployed bundle has production:false', ['src/environments/environment.prod.ts']);
  }
  if (checks.apiUrl && !checks.apiUrl.includes('kolkata-scooty-bike-training.onrender.com')) {
    bug('Frontend', 'Critical', `Wrong API URL in bundle: ${checks.apiUrl}`, ['src/environments/environment.prod.ts']);
  }
  if (!checks.usersPhoneFix) {
    bug('Users', 'Medium', 'Phone display fix may not be deployed in frontend bundle', ['src/app/utils/phone-display.ts']);
  }
  if (!checks.subAdminPolish) {
    bug('Sub Admins', 'Low', 'Sub-admin modal polish may not be deployed yet', ['src/app/admin/pages/sub-admins/sub-admins.component.ts']);
  }

  setModule('Frontend Deploy', checks.productionFlag === true && !!checks.apiUrl, checks);
  report.backendVersion = { health: health?.version, versionEndpoint: version.status, versionData };
}

function scoreReport() {
  const moduleResults = Object.values(report.modules);
  const passed = moduleResults.filter((m) => m.pass === true).length;
  const total = moduleResults.length;
  const crit = report.bugs.filter((b) => b.severity === 'Critical').length;
  const high = report.bugs.filter((b) => b.severity === 'High').length;
  const base = Math.round((passed / Math.max(total, 1)) * 100);
  const penalty = crit * 15 + high * 8 + report.networkFailures.length * 10 + report.authErrors.length * 5;
  report.productionReadinessScore = Math.max(0, Math.min(100, base - penalty));
  report.goLiveRecommendation =
    crit > 0
      ? 'NO-GO — critical bugs must be fixed first'
      : high > 2
        ? 'CONDITIONAL GO — fix high-severity issues before full launch'
        : report.blocked.length > 5
          ? 'CONDITIONAL GO — API layer healthy; complete manual UI QA'
          : 'GO — production APIs healthy, minor issues only';
}

async function main() {
  console.log('Production QA Audit starting...');
  console.log('API:', API_BASE);
  console.log('Frontend:', FE);

  let token;
  try {
    token = await login();
    console.log('Auth: OK');
  } catch (e) {
    bug('Auth', 'Critical', e.message, ['backend/routes/auth.js']);
    setModule('Auth', false, { error: e.message });
    await testFrontendBundle();
    scoreReport();
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  await testDashboard(token);
  await testUsers(token);
  await testTrainers(token);
  await testVehicles(token);
  await testSlots(token);
  await testBookings(token);
  await testNotifications(token);
  await testSubAdmins(token);
  await testSettings(token);
  await testAuditLogs(token);
  await testFrontendBundle();

  scoreReport();

  const summary = {
    pass: Object.entries(report.modules).filter(([, v]) => v.pass).map(([k]) => k),
    fail: Object.entries(report.modules).filter(([, v]) => !v.pass).map(([k]) => k)
  };
  report.summary = summary;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('AUDIT_CRASHED', e);
  process.exit(1);
});
