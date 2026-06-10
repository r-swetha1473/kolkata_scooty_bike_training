const TARGET = process.argv[2] || '74ec45c';
const API = 'https://kolkata-scooty-bike-training.onrender.com/api/version';
const MAX = 40;
const SLEEP = 15000;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  for (let i = 1; i <= MAX; i++) {
    const data = await fetch(API).then((r) => r.json()).catch(() => ({}));
    const commit = (data.commitShort || data.commit || '').slice(0, 7);
    console.log(`[${i}/${MAX}] commit=${commit}`);
    if (commit === TARGET) {
      console.log('ready');
      return;
    }
    await sleep(SLEEP);
  }
  process.exit(1);
}

main();
