/**
 * Poll Render until a8e8966+ is live, then run vehicle CRUD smoke test.
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com/api';
const TARGET = 'a8e8966';
const MAX = 16;
const WAIT_MS = 20000;

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kolkatascotty.com', password: 'admin123' })
  });
  const data = await res.json();
  return data.token;
}

async function req(method, path, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getVersion() {
  const res = await fetch('https://kolkata-scooty-bike-training.onrender.com/api/version');
  const data = await res.json().catch(() => ({}));
  return data.commitShort || '';
}

async function runCrud(token) {
  const ts = Date.now();
  const before = await req('GET', '/vehicles?include_inactive=true', token);
  const beforeList = Array.isArray(before.data) ? before.data : [];
  const activeBefore = beforeList.filter((v) => v.is_active !== false).length;

  const slotsBefore = await fetch(`${API}/slots/available`).then((r) => r.json());
  const capsBefore = [...new Set((slotsBefore.slots || []).map((s) => s.capacity))];

  const created = await req('POST', '/vehicles', token, {
    name: `QA Vehicle ${ts}`,
    max_per_slot: 1,
    is_active: false
  });

  if (created.status !== 201) {
    return { pass: false, step: 'create', created };
  }

  const id = created.data.id;

  const edited = await req('PUT', `/vehicles/${id}`, token, { max_per_slot: 2 });
  const activated = await req('PUT', `/vehicles/${id}`, token, { is_active: true });

  const mid = await req('GET', '/vehicles?include_inactive=true', token);
  const activeMid = (mid.data || []).filter((v) => v.is_active !== false).length;
  const slotsMid = await fetch(`${API}/slots/available`).then((r) => r.json());
  const capsMid = [...new Set((slotsMid.slots || []).map((s) => s.capacity))];

  const deactivated = await req('PUT', `/vehicles/${id}`, token, { is_active: false });
  const deleted = await req('DELETE', `/vehicles/${id}`, token);

  const after = await req('GET', '/vehicles?include_inactive=true', token);
  const afterList = Array.isArray(after.data) ? after.data : [];

  return {
    pass: created.status === 201 && edited.status === 200 && activated.status === 200 &&
      deactivated.status === 200 && deleted.status === 200 &&
      afterList.length === beforeList.length,
    before: { total: beforeList.length, active: activeBefore, capacities: capsBefore },
    create: created,
    edit: { status: edited.status, max_per_slot: edited.data?.max_per_slot },
    activate: { status: activated.status, activeMid, capsMid, expectedCap: activeBefore + 1 },
    deactivate: { status: deactivated.status },
    delete: { status: deleted.status },
    after: { total: afterList.length }
  };
}

async function main() {
  console.log('Waiting for deploy', TARGET);
  for (let i = 1; i <= MAX; i++) {
    const ver = await getVersion();
    console.log(`attempt ${i}/${MAX} backend commit: ${ver || 'unknown'}`);
    if (ver && ver.startsWith(TARGET.slice(0, 7))) {
      const token = await login();
      const result = await runCrud(token);
      console.log(JSON.stringify({ deployed: true, version: ver, ...result }, null, 2));
      process.exit(result.pass ? 0 : 1);
    }
    if (i < MAX) await new Promise((r) => setTimeout(r, WAIT_MS));
  }

  // Try CRUD anyway — Render may deploy without version bump
  const token = await login();
  const result = await runCrud(token);
  console.log(JSON.stringify({ deployed: 'unknown', version: await getVersion(), ...result }, null, 2));
  process.exit(result.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
