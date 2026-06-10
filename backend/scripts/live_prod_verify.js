/**
 * Read-only live production verification (no auth required).
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
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
  const report = {
    timestamp: new Date().toISOString(),
    backend: {},
    frontend: {},
    bugs: [],
    blocked: []
  };

  // Health + version
  const health = await getJson('/health');
  report.backend.health = health;
  const version = await getJson('/api/version');
  report.backend.version = version;
  if (version.status === 404) {
    report.bugs.push('GET /api/version returns 404 — backend deploy missing buildInfo route');
  }
  if (!health.data?.version) {
    report.bugs.push('GET /health has no version field — stale backend deploy');
  }

  // Slot capacity
  const vehicles = await getJson('/api/vehicles');
  const activeVehicles = Array.isArray(vehicles.data)
    ? vehicles.data.filter((v) => v.is_active !== false)
    : [];
  const slotsRes = await getJson('/api/slots/available');
  const slots = Array.isArray(slotsRes.data?.slots)
    ? slotsRes.data.slots
    : Array.isArray(slotsRes.data)
      ? slotsRes.data
      : [];
  const capacities = [...new Set(slots.map((s) => s.capacity))];
  const expected = Math.max(1, activeVehicles.length);
  report.backend.slotCapacity = {
    before: {
      activeVehicles: activeVehicles.length,
      vehicleNames: activeVehicles.map((v) => v.name),
      slotCount: slots.length,
      uniqueCapacities: capacities,
      sample: slots.slice(0, 3).map((s) => ({
        capacity: s.capacity,
        booked_count: s.booked_count,
        start_time: s.start_time
      }))
    },
    expected,
    pass: capacities.length === 1 && capacities[0] === expected,
    after: null
  };
  if (!report.backend.slotCapacity.pass) {
    report.bugs.push(
      `Slot capacity mismatch: ${activeVehicles.length} active vehicles but slots show capacity ${capacities.join(',')}`
    );
  }

  // Settings
  const settings = await getJson('/api/settings');
  report.backend.autoSlotCapacity = settings.data?.auto_slot_capacity_from_vehicles;

  // Admin routes exist (expect 401)
  const adminPaths = [
    '/api/admin/stats',
    '/api/admin/sub-admins',
    '/api/admin/notifications/unread-count',
    '/api/admin/bookings?limit=1&offset=0'
  ];
  report.backend.adminRoutes = {};
  for (const path of adminPaths) {
    const res = await fetch(`${API}${path}`);
    report.backend.adminRoutes[path] = res.status;
    if (res.status === 404) {
      report.bugs.push(`${path} returns 404 — route missing on production`);
    }
  }

  const recalc = await fetch(`${API}/api/admin/slots/recalculate-capacity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  report.backend.recalculateRoute = recalc.status;
  if (recalc.status === 404) {
    report.bugs.push('POST /api/admin/slots/recalculate-capacity not deployed');
  }

  // Frontend
  const indexRes = await fetch(`${FE}/index.html`);
  const indexHtml = await indexRes.text();
  const mainRes = await fetch(`${FE}/main.js`);
  const mainJs = await mainRes.text();
  const chunkRefs = [...new Set([...mainJs.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];

  let productionFlag = null;
  let apiUrl = null;
  for (const chunk of chunkRefs.slice(0, 30)) {
    const txt = await fetch(`${FE}/${chunk}`).then((r) => r.text());
    if (productionFlag == null) {
      const m = txt.match(/production:\s*(true|false)/);
      if (m) productionFlag = m[1] === 'true';
    }
    if (!apiUrl) {
      const m = txt.match(/https:\/\/[^"']+onrender\.com\/api/);
      if (m) apiUrl = m[0];
    }
  }

  report.frontend = {
    indexStatus: indexRes.status,
    ogUrl: (indexHtml.match(/og:url" content="([^"]+)"/) || [])[1],
    productionFlag,
    apiUrl,
    chunkCount: chunkRefs.length
  };
  if (productionFlag === false) {
    report.bugs.push('Frontend bundle has production:false — Vercel may not be using production build');
  }
  if (productionFlag == null) {
    report.blocked.push('Could not locate production flag in deployed chunks');
  }
  if (indexHtml.includes('kolkatascootybiketraining.vercel.app')) {
    report.bugs.push('Deployed index.html still references legacy OG URL (kolkatascootybiketraining.vercel.app)');
  }

  report.blocked.push(
    'Dashboard vs DB, booking search, notifications flow, RBAC UI, admin CRUD, overdue actions, responsive layout — require admin credentials and/or DATABASE_URL'
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
