/**
 * Check whether deployed Vercel bundles include AuthService OAuth token capture.
 */
const FE = 'https://kolkata-scooty-bike-training.vercel.app';

async function loadChunks() {
  const html = await fetch(`${FE}/`).then((r) => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  const entry = scripts.find((s) => s.includes('main')) || '';
  const entryPath = entry.startsWith('/') ? entry : `/${entry}`;
  const main = await fetch(`${FE}${entryPath}`).then((r) => r.text());
  const chunks = new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]));
  const queue = [...chunks];
  const checked = new Set();
  const texts = [];

  while (queue.length) {
    const c = queue.shift();
    if (checked.has(c)) continue;
    checked.add(c);
    const t = await fetch(`${FE}/${c}`).then((r) => r.text()).catch(() => '');
    if (t.startsWith('<!DOCTYPE')) continue;
    texts.push({ chunk: c, text: t });
    for (const m of t.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(m[0])) queue.push(m[0]);
    }
  }

  return texts;
}

async function main() {
  const chunks = await loadChunks();
  const apiCapture = chunks.some((c) => c.text.includes("get('token')") || c.text.includes('get("token")'));
  const oauthSuccess = chunks.some((c) => c.text.includes('oauth') && c.text.includes('success'));
  const authServiceHints = chunks.filter((c) =>
    c.text.includes('userProfileSubject') || c.text.includes('reloadUserProfile')
  );

  console.log({
    chunkCount: chunks.length,
    apiOrAuthTokenCapture: apiCapture,
    oauthSuccessHandler: oauthSuccess,
    authServiceChunks: authServiceHints.map((c) => c.chunk),
    authServiceHasTokenCapture: authServiceHints.some(
      (c) => c.text.includes("get('token')") || c.text.includes('get("token")')
    )
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
