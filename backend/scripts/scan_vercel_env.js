const FE = 'https://kolkata-scooty-bike-training.vercel.app';

async function main() {
  const mainJs = await fetch(`${FE}/main.js`).then((r) => r.text());
  const chunks = [...new Set([...mainJs.matchAll(/chunk-[A-Z0-9]+\.js/g)].map((m) => m[0]))];
  let production = null;
  let apiUrl = null;
  let hits = [];

  for (const chunk of chunks) {
    const txt = await fetch(`${FE}/${chunk}`).then((r) => r.text());
    const prodMatch = txt.match(/production:\s*(!0|!1|true|false)/);
    if (prodMatch && production == null) {
      production = prodMatch[1];
      hits.push({ chunk, production: prodMatch[0] });
    }
    const apiMatch = txt.match(/https:\/\/[^"']+onrender\.com\/api/);
    if (apiMatch && !apiUrl) {
      apiUrl = apiMatch[0];
      hits.push({ chunk, apiUrl });
    }
  }

  console.log(JSON.stringify({ chunkCount: chunks.length, production, apiUrl, hits }, null, 2));
}

main().catch(console.error);
