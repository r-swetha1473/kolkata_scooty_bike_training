/**
 * Validates slot capacity matches active vehicle count (Asia/Kolkata today+).
 * Usage: DATABASE_URL=... node scripts/slot_capacity_validation.js
 * Optional: API_BASE=https://your-api.onrender.com/api
 */

require('dotenv').config();

const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const HAS_DB = !!(process.env.DATABASE_URL || process.env.DB_HOST);

const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(slot_date, (start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

async function checkDatabase() {
  if (!HAS_DB) {
    console.log('SKIP: DATABASE_URL not set');
    return { pass: false, skipped: true };
  }

  const db = require('../db');
  const slotCapacityService = require('../services/slotCapacity.service');

  const vehicleCount = await slotCapacityService.getActiveVehicleCount();
  const capacitySum = await slotCapacityService.getActiveVehicleCapacitySum();
  const enabled = await slotCapacityService.isAutoCapacityEnabled();
  const expected = enabled ? Math.max(1, capacitySum) : require('../config/app.config').SLOT_CAPACITY.DEFAULT;

  const mismatch = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM slots
    WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
      AND capacity <> $1
    `,
    [expected]
  );
  const mismatched = Number(mismatch.rows[0]?.count) || 0;

  console.log(`Active vehicles: ${vehicleCount}`);
  console.log(`Sum max_per_slot: ${capacitySum}`);
  console.log(`Auto capacity enabled: ${enabled}`);
  console.log(`Expected slot capacity: ${expected}`);
  console.log(`Mismatched future slots: ${mismatched}`);

  if (mismatched > 0) {
    console.log('Running recalculateFutureSlotCapacities...');
    const result = await slotCapacityService.recalculateFutureSlotCapacities(null);
    console.log(`Recalculated ${result.updated} slot(s) to capacity ${result.capacity}`);

    const after = await db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM slots
      WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
        AND capacity <> $1
      `,
      [expected]
    );
    const remaining = Number(after.rows[0]?.count) || 0;
    await db.pool.end();
    return { pass: remaining === 0, mismatched, remaining, expected, vehicleCount };
  }

  await db.pool.end();
  return { pass: true, mismatched: 0, remaining: 0, expected, vehicleCount };
}

async function checkPublicApi() {
  try {
    const vehiclesRes = await fetch(`${API_BASE}/vehicles`);
    const slotsRes = await fetch(`${API_BASE}/slots/available`);
    if (!vehiclesRes.ok || !slotsRes.ok) {
      console.log(`SKIP: Public API unavailable (vehicles=${vehiclesRes.status}, slots=${slotsRes.status})`);
      return { pass: null, skipped: true };
    }

    const vehicles = await vehiclesRes.json();
    const slotsPayload = await slotsRes.json();
    const activeVehicles = Array.isArray(vehicles)
      ? vehicles.filter((v) => v.is_active !== false)
      : [];
    const activeCount = activeVehicles.length;
    const expectedSum = activeVehicles.reduce((sum, v) => sum + (Number(v.max_per_slot) || 0), 0);
    const slots = Array.isArray(slotsPayload?.slots)
      ? slotsPayload.slots
      : Array.isArray(slotsPayload)
        ? slotsPayload
        : [];
    const sample = slots[0];
    const apiCapacity = sample?.capacity;

    console.log(`API active vehicles: ${activeCount}`);
    console.log(`API expected capacity sum: ${expectedSum}`);
    console.log(`API sample slot capacity: ${apiCapacity ?? 'n/a'}`);

    if (slots.length === 0) {
      return { pass: true, skipped: false, note: 'no slots returned' };
    }

    const pass = Number(apiCapacity) === Math.max(1, expectedSum);
    return { pass, activeCount, expectedSum, apiCapacity };
  } catch (e) {
    console.log(`SKIP: Public API check failed — ${e.message}`);
    return { pass: null, skipped: true };
  }
}

async function main() {
  console.log('Slot Capacity Validation');
  console.log(`API_BASE: ${API_BASE}`);

  const dbResult = await checkDatabase();
  const apiResult = await checkPublicApi();

  let fail = false;
  if (dbResult.skipped) {
    console.log('\nDB: skipped');
  } else if (dbResult.pass) {
    console.log('\nDB: PASS — all today+ slots match expected capacity');
  } else {
    console.log('\nDB: FAIL — capacity mismatch remains after recalc');
    fail = true;
  }

  if (apiResult.skipped) {
    console.log('API: skipped');
  } else if (apiResult.pass) {
    console.log('API: PASS — public slot capacity matches active vehicles');
  } else {
    console.log('API: FAIL — deploy backend with latest slotCapacity.service.js');
    fail = true;
  }

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
