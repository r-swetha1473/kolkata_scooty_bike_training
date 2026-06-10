/**
 * Poll Vercel until sub-admin modal polish markers appear in deployed chunks.
 */
const FE = 'https://kolkata-scooty-bike-training.vercel.app';
const TARGET = '45ed363';
const MAX_ATTEMPTS = 12;
const INTERVAL_MS = 15000;

const MARKERS = ['accountModalPanel', 'compact-modal', 'getActiveModalPanel', 'modal-action-btn'];

async function fetchText(path) {
  const res = await fetch(`${FE}${path}`, { cache: 'no-store' });
  if (!res.ok) return '';
  const text = await res.text();
  return text.startsWith('<!DOCTYPE') ? '' : text;
}

async function scanAllChunks() {
  const found = Object.fromEntries(MARKERS.map((m) => [m, false]));
  const checked = new Set();
  const queue = [];

  const main = await fetchText('/main.js');
  if (!main) return { found, chunkCount: 0, error: 'main.js unavailable' };

  for (const m of main.matchAll(/chunk-[A-Z0-9]+\.js/g)) queue.push(m[0]);

  while (queue.length) {
    const name = queue.shift();
    if (checked.has(name)) continue;
    checked.add(name);

    const text = await fetchText(`/${name}`);
    if (!text) continue;

    for (const marker of MARKERS) {
      if (text.includes(marker)) found[marker] = true;
    }

    for (const m of text.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(m[0])) queue.push(m[0]);
    }
  }

  return {
    found,
    chunkCount: checked.size,
    deployed: found.accountModalPanel && found.compactModal && found.getActiveModalPanel
  };
}

async function main() {
  console.log(`Polling ${FE} for commit ${TARGET} markers...`);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await scanAllChunks();
    const ts = new Date().toISOString();
    console.log(`[${ts}] attempt ${attempt}/${MAX_ATTEMPTS}`, JSON.stringify(result));

    if (result.deployed) {
      console.log('DEPLOY_VERIFIED', JSON.stringify({ ok: true, targetCommit: TARGET, ...result }, null, 2));
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  console.log('DEPLOY_PENDING', JSON.stringify({ ok: false, targetCommit: TARGET, message: 'Markers not found yet; Vercel may still be building' }, null, 2));
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
