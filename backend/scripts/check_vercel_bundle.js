const FE = 'https://kolkata-scooty-bike-training.vercel.app';

async function fetchText(path) {
  const res = await fetch(`${FE}${path}`, { cache: 'no-store' });
  console.log(path, res.status, res.headers.get('content-type'));
  if (!res.ok) return '';
  return res.text();
}

async function main() {
  const html = await fetchText('/');
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  console.log('scripts:', scripts);

  const entry = scripts.find((s) => s.includes('main')) || scripts.find((s) => s.endsWith('.js'));
  if (!entry) {
    console.log('No entry script found');
    return;
  }

  const entryPath = entry.startsWith('http') ? entry.replace(FE, '') : (entry.startsWith('/') ? entry : '/' + entry);
  const main = await fetchText(entryPath);
  console.log('entry size', main.length);

  const chunks = [...new Set([...main.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];
  console.log('root chunks', chunks.length, chunks);

  const markers = ['accountModalPanel', 'compact-modal', 'getActiveModalPanel'];
  const checked = new Set();
  const queue = [...chunks];
  let hit = null;

  while (queue.length) {
    const name = queue.shift();
    if (checked.has(name)) continue;
    checked.add(name);
    const text = await fetchText('/' + name);
    if (!text || text.startsWith('<!DOCTYPE')) continue;
    const hits = markers.filter((m) => text.includes(m));
    if (hits.length) {
      hit = { chunk: name, hits };
      console.log('FOUND', JSON.stringify(hit));
    }
    for (const m of text.matchAll(/chunk-[A-Z0-9]+\.js/g)) {
      if (!checked.has(m[0])) queue.push(m[0]);
    }
  }

  console.log('total chunks scanned', checked.size);
  console.log('deployed', !!(hit && hit.hits.includes('accountModalPanel') && hit.hits.includes('compact-modal')));
}

main();
