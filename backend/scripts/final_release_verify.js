/**
 * Final production release verification — all admin modules.
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com/api';
const API_ROOT = 'https://kolkata-scooty-bike-training.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';
const STALE_HOST = 'kolkata-scooty-bike-training-1ild.onrender.com';

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kolkatascotty.com', password: 'admin123' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login ${res.status}`);
  return data.token;
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function scanFrontend() {
  const html = await fetch(`${FE}/`).then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const entry = scripts.find((s) => s.includes('main')) || '';
  const entryPath = entry.startsWith('/') ? entry : `/${entry}`;
  const main = await fetch(`${FE}${entryPath}`).then((r) => r.text());
  const chunks = new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]));
  const queue = [...chunks];
  const checked = new Set();
  let productionFlag = false;
  let apiUrl = null;
  let staleHost = false;
  let subAdminPolish = false;

  while (queue.length) {
    const c = queue.shift();
    if (checked.has(c)) continue;
    checked.add(c);
    const t = await fetch(`${FE}/${c}`).then((r) => r.text()).catch(() => '');
    if (t.startsWith('<!DOCTYPE')) continue;
    if (t.includes('production:!0') || t.includes('production:true')) productionFlag = true;
    const m = t.match(/https:\/\/[^"']+onrender\.com\/api/);
    if (m) apiUrl = m[0];
    if (t.includes(STALE_HOST)) staleHost = true;
    if (t.includes('accountModalPanel') && t.includes('compact-modal')) subAdminPolish = true;
    for (const ref of t.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(ref[0])) queue.push(ref[0]);
    }
  }

  return { productionFlag, apiUrl, staleHost, subAdminPolish, chunkCount: checked.size, entry: entryPath };
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    deploy: {},
    modules: {},
    failures: [],
    auth: {}
  };

  const health = await fetch(`${API_ROOT}/health`).then((r) => ({ status: r.status, data: r.json().then((d) => d) }));
  report.deploy.health = { status: health.status, data: await health.data };

  const version = await fetch(`${API_ROOT}/api/version`).then((r) => r.json());
  report.deploy.version = version;

  const fe = await scanFrontend();
  report.deploy.frontend = fe;
  report.deploy.frontendPass =
    fe.productionFlag &&
    fe.apiUrl === 'https://kolkata-scooty-bike-training.onrender.com/api' &&
    !fe.staleHost;

  if (!report.deploy.frontendPass) {
    if (!fe.productionFlag) report.failures.push('production flag not found in bundle');
    if (fe.apiUrl !== 'https://kolkata-scooty-bike-training.onrender.com/api') report.failures.push(`API URL: ${fe.apiUrl}`);
    if (fe.staleHost) report.failures.push('stale -1ild hostname in bundle');
  }

  const token = await login();
  report.auth.login = 200;

  const checks = [
    ['Dashboard', '/admin/stats'],
    ['Dashboard-notifications', '/admin/notifications/unread-count'],
    ['Users', '/admin/users?limit=5'],
    ['Users-search', '/admin/users?search=rajani'],
    ['Users-export', null],
    ['Trainers', '/admin/trainers'],
    ['Vehicles', '/vehicles?include_inactive=true'],
    ['Slots', null],
    ['Bookings', '/admin/bookings?limit=5&offset=0'],
    ['Bookings-overdue', '/admin/bookings/overdue'],
    ['Notifications', '/admin/notifications?limit=5'],
    ['Settings', '/admin/settings'],
    ['Audit Logs', '/admin/audit-logs?limit=5'],
    ['Sub Admins', '/admin/sub-admins'],
    ['RBAC-admins', '/admin/admins']
  ];

  for (const [name, path] of checks) {
    if (name === 'Users-export') {
      const r = await fetch(`${API}/admin/customers/export`, { headers: { Authorization: `Bearer ${token}` } });
      report.modules[name] = { status: r.status, pass: r.status === 200 };
    } else if (name === 'Slots') {
      const r = await fetch(`${API}/slots/available`);
      const d = await r.json();
      const slots = d.slots || d || [];
      const caps = [...new Set(slots.map((s) => s.capacity))];
      const veh = await get('/vehicles', token);
      const active = (veh.data || []).filter((v) => v.is_active !== false).length;
      report.modules[name] = {
        status: r.status,
        pass: r.status === 200 && caps.length === 1 && caps[0] === Math.max(1, active),
        activeVehicles: active,
        capacities: caps
      };
    } else {
      const r = await get(path, token);
      report.modules[name] = { status: r.status, pass: r.status === 200 };
    }
    if (!report.modules[name].pass) report.failures.push(`${name}: ${report.modules[name].status}`);
  }

  // Vehicle create smoke
  const ts = Date.now();
  const vCreate = await fetch(`${API}/vehicles`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Release QA ${ts}`, max_per_slot: 1, is_active: false })
  });
  const vData = await vCreate.json();
  report.modules['Vehicles-create'] = { status: vCreate.status, pass: vCreate.status === 201 };
  if (vCreate.status === 201) {
    await fetch(`${API}/vehicles/${vData.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  } else {
    report.failures.push(`Vehicles-create: ${vCreate.status}`);
  }

  const users = await get('/admin/users?limit=50', token);
  const ulist = users.data?.users || [];
  const leaks = ulist.filter((u) => /^GOOGLE_/i.test(String(u.phone || '')));
  report.modules['Users-phone-sanitize'] = { pass: leaks.length === 0, googleLeaks: leaks.length };

  report.modules['Sub Admins UI'] = { pass: fe.subAdminPolish, note: 'bundle markers' };

  const modulePass = Object.values(report.modules).every((m) => m.pass !== false);
  const deployPass = report.deploy.health.status === 200 && report.deploy.version.ok && report.deploy.frontendPass;
  report.overallPass = modulePass && deployPass && leaks.length === 0;
  report.readinessScore = report.overallPass ? 94 : report.failures.length <= 2 ? 88 : 75;

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.overallPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
