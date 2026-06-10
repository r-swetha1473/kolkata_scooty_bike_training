/**
 * Production verification for slots, capacity, and booking times.
 * Run: node backend/scripts/verify_slots_production.js
 */
const API = 'https://kolkata-scooty-bike-training.onrender.com/api';

function kolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function main() {
  const today = kolkataToday();
  const tomorrow = addDays(today, 1);
  const results = [];

  const vehicles = await fetch(`${API}/vehicles`).then((r) => r.json());
  const active = (vehicles || []).filter((v) => v.is_active !== false);
  const expectedCapacity = active.reduce((s, v) => s + (Number(v.max_per_slot) || 0), 0);

  console.log('=== Slots Production Verification ===');
  console.log(`Kolkata today: ${today}`);
  console.log(`Active vehicles: ${active.map((v) => `${v.name}(${v.max_per_slot})`).join(', ')}`);
  console.log(`Expected capacity sum: ${expectedCapacity}`);

  for (const date of [today, tomorrow]) {
    const all = await fetch(`${API}/slots/date/${date}`).then((r) => r.json());
    const bookable = await fetch(`${API}/slots/date/${date}?bookable_only=true`).then((r) => r.json());
    const sample = (bookable[0] || all[0]) || null;
    console.log(`\n${date}: all=${all.length} bookable=${bookable.length} sample_capacity=${sample?.capacity ?? 'n/a'}`);
    results.push({
      date,
      all: all.length,
      bookable: bookable.length,
      sampleCapacity: sample?.capacity
    });
  }

  const capPass = results.some((r) => r.sampleCapacity === expectedCapacity);
  const slotsPass = results.some((r) => r.bookable > 0);

  console.log(`\nCapacity matches expected (${expectedCapacity}): ${capPass ? 'PASS' : 'FAIL (deploy + recalc needed)'}`);
  console.log(`Bookable slots available: ${slotsPass ? 'PASS' : 'FAIL'}`);

  const version = await fetch('https://kolkata-scooty-bike-training.onrender.com/api/version')
    .then((r) => r.json())
    .catch(() => ({}));
  console.log(`Backend commit: ${version.commitShort || version.commit || 'unknown'}`);

  process.exit(capPass && slotsPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
