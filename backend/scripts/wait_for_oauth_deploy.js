/**
 * Poll production until backend commit e757ec2 and frontend AuthService token capture deploy.
 */
const TARGET_COMMIT = 'e757ec2';
const API_ROOT = 'https://kolkata-scooty-bike-training.onrender.com';
const FE = 'https://kolkata-scooty-bike-training.vercel.app';
const MAX_ATTEMPTS = 40;
const INTERVAL_MS = 15000;

async function getBackendCommit() {
  const data = await fetch(`${API_ROOT}/api/version`).then((r) => r.json()).catch(() => ({}));
  return (data.commitShort || data.commit || '').slice(0, 7);
}

async function getFrontendAuthServiceTokenCapture() {
  const html = await fetch(`${FE}/`).then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const entry = scripts.find((s) => s.includes('main')) || '';
  const entryPath = entry.startsWith('/') ? entry : `/${entry}`;
  const main = await fetch(`${FE}${entryPath}`).then((r) => r.text());
  const chunks = new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]));
  const queue = [...chunks];
  const checked = new Set();

  while (queue.length) {
    const c = queue.shift();
    if (checked.has(c)) continue;
    checked.add(c);
    const t = await fetch(`${FE}/${c}`).then((r) => r.text()).catch(() => '');
    if (t.startsWith('<!DOCTYPE')) continue;
    if (
      (t.includes('userProfileSubject') || t.includes('reloadUserProfile')) &&
      (t.includes("get('token')") || t.includes('get("token")'))
    ) {
      return { ready: true, chunk: c };
    }
    for (const m of t.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(m[0])) queue.push(m[0]);
    }
  }
  return { ready: false, chunk: null };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let backendCommit = '';
  let frontendReady = false;
  let frontendChunk = null;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    backendCommit = await getBackendCommit();
    const fe = await getFrontendAuthServiceTokenCapture();
    frontendReady = fe.ready;
    frontendChunk = fe.chunk;

    const backendReady = backendCommit === TARGET_COMMIT;
    console.log(
      `[${i}/${MAX_ATTEMPTS}] backend=${backendCommit} frontendAuthServiceToken=${frontendReady ? 'yes' : 'no'}`
    );

    if (backendReady && frontendReady) {
      console.log(JSON.stringify({
        status: 'ready',
        backendCommit,
        frontendChunk,
        attempts: i
      }));
      return;
    }

    await sleep(INTERVAL_MS);
  }

  console.log(JSON.stringify({
    status: 'timeout',
    backendCommit,
    frontendReady,
    frontendChunk,
    targetCommit: TARGET_COMMIT
  }));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
