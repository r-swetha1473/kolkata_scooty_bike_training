/**
 * Post-deployment smoke test for production.
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';
const TARGET = '45ed363';

async function api(path, token, method = 'GET', body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  return { status: res.status, data };
}

async function scanFrontend() {
  const markers = {
    accountModalPanel: false,
    compactModal: false,
    getActiveModalPanel: false,
    notProvided: false,
    formatUserPhone: false
  };
  const checked = new Set();

  async function loadChunk(name) {
    if (checked.has(name)) return '';
    checked.add(name);
    const res = await fetch(`${FE}/${name}`);
    if (!res.ok) return '';
    const text = await res.text();
    if (text.startsWith('<!DOCTYPE')) return '';
    for (const m of text.matchAll(/chunk-[A-Z0-9]+\.js/g)) await loadChunk(m[0]);
    return text;
  }

  const main = await fetch(`${FE}/main.js`).then((r) => r.text());
  const roots = [...new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];
  for (const root of roots) {
    const text = await loadChunk(root);
    if (text.includes('accountModalPanel')) markers.accountModalPanel = true;
    if (text.includes('compact-modal')) markers.compactModal = true;
    if (text.includes('getActiveModalPanel')) markers.getActiveModalPanel = true;
    if (text.includes('Not Provided')) markers.notProvided = true;
    if (text.includes('isGooglePhonePlaceholder')) markers.formatUserPhone = true;
  }

  // Angular lazy route chunks are referenced from layout chunk imports
  for (const name of checked) {
    const text = await fetch(`${FE}/${name}`).then((r) => r.text()).catch(() => '');
    if (text.startsWith('<!DOCTYPE')) continue;
    const lazyRefs = [...text.matchAll(/["'](chunk-[A-Z0-9]+\.js)["']/g)].map((m) => m[1]);
    for (const ref of lazyRefs) {
      const lazyText = await loadChunk(ref);
      if (lazyText.includes('accountModalPanel')) markers.accountModalPanel = true;
      if (lazyText.includes('compact-modal')) markers.compactModal = true;
      if (lazyText.includes('getActiveModalPanel')) markers.getActiveModalPanel = true;
      if (lazyText.includes('Not Provided')) markers.notProvided = true;
      if (lazyText.includes('isGooglePhonePlaceholder')) markers.formatUserPhone = true;
    }
  }

  return { markers, chunkCount: checked.size };
}

async function main() {
  const report = { targetCommit: TARGET, timestamp: new Date().toISOString(), modules: {}, issues: [], deploy: {} };

  const health = await api('/health');
  const version = await api('/api/version');
  report.deploy.backendCommit = health.data?.version?.commitShort || version.data?.commitShort;
  report.deploy.backendAtTarget = String(report.deploy.backendCommit || '').startsWith('7b637fd');

  const { requireAdminCreds } = require('./lib/requireAdminCreds');
  const { email, password } = requireAdminCreds();
  const login = await api('/api/auth/login', null, 'POST', { email, password });
  const token = login.data?.token;
  report.auth = login.status;

  if (!token) {
    report.issues.push({ severity: 'Critical', message: 'Admin login failed', module: 'Auth' });
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const stats = await api('/api/admin/stats', token);
  const unread = await api('/api/admin/notifications/unread-count', token);
  const notifs = await api('/api/admin/notifications?limit=5', token);
  report.modules.Dashboard = {
    result: stats.status === 200 && unread.status === 200 && notifs.status === 200 ? 'PASS' : 'FAIL',
    stats: stats.status, unread: unread.status, notifications: notifs.status, unreadCount: unread.data?.count
  };

  const users = await api('/api/admin/users?limit=50', token);
  const search = await api('/api/admin/users?search=rajani', token);
  const exportRes = await fetch(`${API}/api/admin/customers/export`, { headers: { Authorization: `Bearer ${token}` } });
  const ulist = users.data?.users || [];
  const leaks = ulist.filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
  report.modules.Users = {
    result: users.status === 200 && search.status === 200 && exportRes.status === 200 && leaks.length === 0 ? 'PASS' : 'FAIL',
    list: users.status, search: search.status, searchHits: (search.data?.users || []).length,
    export: exportRes.status, googleLeaks: leaks.length
  };

  const b1 = await api('/api/admin/bookings?limit=10&offset=0', token);
  const b2 = await api('/api/admin/bookings?limit=10&offset=10', token);
  const bsearch = await api('/api/admin/bookings?search=test&limit=5', token);
  const overdue = await api('/api/admin/bookings/overdue', token);
  report.modules.Bookings = {
    result: b1.status === 200 && b2.status === 200 && bsearch.status === 200 && overdue.status === 200 ? 'PASS' : 'FAIL',
    page1: b1.status, page2: b2.status, search: bsearch.status, overdue: overdue.status, total: b1.data?.total, overdueCount: Array.isArray(overdue.data) ? overdue.data.length : null
  };

  const subs = await api('/api/admin/sub-admins', token);
  const admins = await api('/api/admin/admins', token);
  report.modules['Sub Admins API'] = {
    result: subs.status === 200 && admins.status === 200 ? 'PASS' : 'FAIL',
    subAdmins: subs.status, admins: admins.status
  };

  const settings = await api('/api/admin/settings', token);
  const save = await api('/api/admin/settings', token, 'PUT', settings.data);
  const recalc = await api('/api/admin/slots/recalculate-capacity', token, 'POST', {});
  report.modules.Settings = {
    result: settings.status === 200 && save.status === 200 && recalc.status === 200 ? 'PASS' : 'FAIL',
    get: settings.status, save: save.status, recalc: recalc.status
  };

  const a1 = await api('/api/admin/audit-logs?limit=10&offset=0', token);
  const a2 = await api('/api/admin/audit-logs?limit=10&offset=10', token);
  const af = await api('/api/admin/audit-logs?action=LOGIN&limit=10', token);
  report.modules['Audit Logs'] = {
    result: a1.status === 200 && a2.status === 200 && af.status === 200 ? 'PASS' : 'FAIL',
    page1: a1.status, page2: a2.status, filter: af.status
  };

  const fe = await scanFrontend();
  report.deploy.frontend = fe;
  const polishDeployed = fe.markers.accountModalPanel && fe.markers.compactModal && fe.markers.getActiveModalPanel;
  report.modules['Sub Admins UI'] = {
    result: polishDeployed ? 'PASS' : 'FAIL',
    polishDeployed,
    markers: fe.markers,
    note: 'Commit 45ed363 must be pushed to Vercel for modal polish'
  };

  if (!polishDeployed) {
    report.issues.push({
      severity: 'High',
      module: 'Sub Admins UI',
      message: 'Sub-admin modal polish (45ed363) not detected in live Vercel bundle — commit may not be pushed/deployed'
    });
  }

  report.modules['Console / Network / Layout'] = {
    result: 'BLOCKED',
    note: 'Requires manual browser DevTools verification'
  };

  const apiModules = ['Dashboard', 'Users', 'Bookings', 'Sub Admins API', 'Settings', 'Audit Logs'];
  const apiPass = apiModules.every((m) => report.modules[m].result === 'PASS');
  report.productionReadinessScore = polishDeployed ? (apiPass ? 94 : 75) : (apiPass ? 82 : 65);
  report.goLiveRecommendation = polishDeployed && apiPass
    ? 'GO — APIs healthy and UI polish deployed; complete 5-min browser spot-check'
    : apiPass
      ? 'CONDITIONAL GO — APIs healthy; push 45ed363 and redeploy Vercel before final go-live'
      : 'NO-GO — fix API failures first';

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
