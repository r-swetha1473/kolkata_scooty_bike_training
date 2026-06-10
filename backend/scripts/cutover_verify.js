const ACTIVE = 'https://kolkata-scooty-bike-training.onrender.com';
const OLD = 'https://kolkata-scooty-bike-training-1ild.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';

async function probeBackend(base) {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  let version = null;
  try {
    version = await fetch(`${base}/api/version`).then((r) => (r.ok ? r.json() : null));
  } catch {
    version = null;
  }
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const routes = {};
  for (const path of [
    '/api/admin/stats',
    '/api/admin/bookings?limit=1',
    '/api/admin/trainers',
    '/api/vehicles',
    '/api/slots/available',
    '/api/admin/settings'
  ]) {
    const r = await fetch(`${base}${path}`);
    routes[path] = r.status;
  }
  return { health, version, loginStatus: login.status, routes };
}

async function scanFrontend() {
  const index = await fetch(`${FE}/index.html`).then((r) => r.text());
  const mainFile = (index.match(/main-[A-Z0-9]+\.js/) || ['main.js'])[0];
  const mainJs = await fetch(`${FE}/${mainFile}`).then((r) => r.text());
  const chunks = [...new Set([...mainJs.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];
  let has1ild = false;
  let hasActive = false;
  let apiUrl = null;
  let production = null;

  for (const chunk of chunks) {
    const txt = await fetch(`${FE}/${chunk}`).then((r) => r.text());
    if (txt.includes('1ild')) has1ild = true;
    if (txt.includes('kolkata-scooty-bike-training.onrender.com')) hasActive = true;
    const prod = txt.match(/production:\s*(!0|!1|true|false)/);
    if (prod && production == null) production = prod[1];
    const api = txt.match(/apiUrl:"([^"]+)"/);
    if (api && !apiUrl) apiUrl = api[1];
  }

  return { mainFile, chunkCount: chunks.length, has1ild, hasActive, apiUrl, production };
}

async function main() {
  const [active, old, fe] = await Promise.all([
    probeBackend(ACTIVE),
    probeBackend(OLD),
    scanFrontend()
  ]);

  console.log(
    JSON.stringify(
      {
        activeBackendCommit: active.version?.commitShort || active.health?.version?.commitShort || null,
        oldBackendCommit: old.version?.commitShort || old.health?.version?.commitShort || null,
        oldVersionEndpoint: old.version ? 200 : 404,
        frontend: fe,
        activeRoutes: active.routes,
        loginReachable: active.loginStatus === 400 || active.loginStatus === 401
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
