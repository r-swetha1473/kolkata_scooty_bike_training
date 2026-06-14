/**
 * Slot capacity derived from SUM(max_per_slot) of active vehicles when auto-calculation is enabled.
 */

const db = require('../db');
const { SLOT_CAPACITY } = require('../config/app.config');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');

const SETTING_KEY = 'auto_slot_capacity_from_vehicles';
const KOLKATA_TODAY = `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
const SLOT_DAY = `COALESCE(slot_date, (start_time AT TIME ZONE 'Asia/Kolkata')::date)`;

function parseSettingBool(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed === true;
    } catch {
      return value === 'true';
    }
  }
  return false;
}

async function query(client, sql, params) {
  if (client) {
    return client.query(sql, params);
  }
  return db.query(sql, params);
}

async function isAutoCapacityEnabled(client = null) {
  const result = await query(
    client,
    'SELECT value FROM settings WHERE key = $1',
    [SETTING_KEY]
  );
  if (result.rows.length === 0) {
    return true;
  }
  return parseSettingBool(result.rows[0].value);
}

async function getActiveVehicleCount(client = null) {
  const result = await query(
    client,
    'SELECT COUNT(*)::int AS count FROM vehicles WHERE is_active = true'
  );
  return Math.max(0, parseInt(result.rows[0]?.count || 0, 10));
}

/** Sum of max_per_slot across active vehicles — the correct aggregate slot capacity. */
async function getActiveVehicleCapacitySum(client = null) {
  const result = await query(
    client,
    'SELECT COALESCE(SUM(max_per_slot), 0)::int AS total FROM vehicles WHERE is_active = true'
  );
  return Math.max(0, parseInt(result.rows[0]?.total || 0, 10));
}

/**
 * Resolves slot capacity for new/updated slots.
 * When auto mode is on: capacity = SUM(max_per_slot) of active vehicles (minimum 1).
 */
async function resolveSlotCapacity(client = null) {
  const enabled = await isAutoCapacityEnabled(client);
  if (!enabled) {
    return SLOT_CAPACITY.DEFAULT;
  }
  const total = await getActiveVehicleCapacitySum(client);
  return Math.max(1, total);
}

async function pruneInactiveSlotVehicleCapacities(slotIds = null, client = null) {
  try {
    if (Array.isArray(slotIds) && slotIds.length > 0) {
      await query(client, 'SELECT prune_inactive_slot_vehicle_capacities($1::uuid[])', [slotIds]);
      return;
    }
    await query(
      client,
      `
      DELETE FROM slot_vehicle_capacity svc
      USING vehicles v, slots s
      WHERE svc.vehicle_id = v.id
        AND svc.slot_id = s.id
        AND v.is_active = false
        AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date) >= ${KOLKATA_TODAY}
      `
    );
  } catch (e) {
    const msg = String(e.message || '');
    if (!msg.includes('does not exist') && !msg.includes('prune_inactive_slot_vehicle_capacities')) {
      console.warn('[slotCapacity] pruneInactiveSlotVehicleCapacities:', msg);
    }
  }
}

async function syncSlotVehicleCapacities(slotIds, client = null) {
  for (const slotId of slotIds) {
    try {
      await query(client, 'SELECT ensure_slot_vehicle_capacities($1)', [slotId]);
      await query(
        client,
        `
        UPDATE slot_vehicle_capacity svc
        SET capacity = v.max_per_slot
        FROM vehicles v
        WHERE svc.vehicle_id = v.id
          AND svc.slot_id = $1
          AND v.is_active = true
        `,
        [slotId]
      );
    } catch (e) {
      const msg = String(e.message || '');
      if (!msg.includes('does not exist') && !msg.includes('ensure_slot_vehicle_capacities')) {
        console.warn('[slotCapacity] syncSlotVehicleCapacities:', msg);
      }
    }
  }
  await pruneInactiveSlotVehicleCapacities(slotIds, client);
}

async function fetchActiveTrainerIds(client = null) {
  const result = await query(
    client,
    `SELECT id FROM trainers WHERE is_active = true ORDER BY created_at ASC NULLS LAST, id ASC`
  );
  return result.rows.map((row) => row.id);
}

/** Assign round-robin trainers to future slots missing trainer_id so they become bookable. */
async function assignMissingTrainerIds(client = null) {
  const trainerIds = await fetchActiveTrainerIds(client);
  if (trainerIds.length === 0) {
    return { updated: 0 };
  }

  const orphans = await query(
    client,
    `
    SELECT id
    FROM slots
    WHERE trainer_id IS NULL
      AND ${SLOT_DAY} >= ${KOLKATA_TODAY}
      AND status NOT IN ('cancelled', 'completed', 'disabled')
    ORDER BY start_time ASC
    `,
    []
  );

  let seq = 0;
  for (const row of orphans.rows) {
    const trainerId = trainerIds[seq % trainerIds.length];
    await query(
      client,
      `UPDATE slots SET trainer_id = $1, updated_at = NOW() WHERE id = $2`,
      [trainerId, row.id]
    );
    seq += 1;
  }

  if (orphans.rows.length > 0) {
    console.log(`[slotCapacity] Assigned trainers to ${orphans.rows.length} slot(s) missing trainer_id`);
  }

  return { updated: orphans.rows.length };
}

/**
 * Updates capacity on all slots from today (Asia/Kolkata) onward.
 * Includes today's in-progress slots (uses slot day, not start_time > NOW()).
 */
async function recalculateFutureSlotCapacities(adminId = null, client = null) {
  const enabled = await isAutoCapacityEnabled(client);
  const vehicleCount = await getActiveVehicleCount(client);
  const capacitySum = await getActiveVehicleCapacitySum(client);
  const capacity = enabled ? Math.max(1, capacitySum) : SLOT_CAPACITY.DEFAULT;

  await assignMissingTrainerIds(client);

  const result = await query(
    client,
    `
    UPDATE slots
    SET capacity = GREATEST(booked_count, $1),
        capacity_exceeded = (booked_count > $1),
        updated_at = NOW(),
        status = CASE
          WHEN status IN ('cancelled', 'completed', 'disabled') THEN status
          WHEN booked_count > $1 OR booked_count >= GREATEST(booked_count, $1) THEN 'full'
          ELSE 'available'
        END
    WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
    RETURNING id, capacity_exceeded
    `,
    [capacity]
  );

  const exceededCount = result.rows.filter((r) => r.capacity_exceeded).length;
  if (exceededCount > 0) {
    await notificationService.createNotification({
      type: 'slot_capacity',
      title: 'Capacity exceeded on slot(s)',
      body: `${exceededCount} slot(s) have more bookings than active vehicle capacity. Existing bookings are preserved; no new bookings allowed until resolved.`,
      entity_type: 'slot',
      entity_id: null,
      dedupeHours: 1
    }).catch(() => {});
  }

  const slotIds = result.rows.map((r) => r.id);
  if (slotIds.length > 0) {
    await syncSlotVehicleCapacities(slotIds, client);
  }

  if (result.rows.length > 0) {
    await auditService.logSlotCapacityUpdate(adminId, {
      auto_enabled: enabled,
      new_capacity: capacity,
      active_vehicles: vehicleCount,
      capacity_sum: capacitySum,
      slots_updated: result.rows.length
    });
    await notificationService.createNotification({
      type: 'slot_capacity',
      title: 'Slot capacity updated',
      body: `${result.rows.length} slot(s) from today onward set to capacity ${capacity} (sum of max_per_slot across ${vehicleCount} active vehicle(s)).`,
      entity_type: 'slot',
      entity_id: null,
      dedupeHours: 1
    }).catch(() => {});
  }

  return {
    updated: result.rows.length,
    capacity,
    active_vehicles: vehicleCount,
    capacity_sum: capacitySum,
    auto_enabled: enabled
  };
}

/** Sum of active vehicle capacities for a slot payload (API rows or DB). */
function computeLiveCapacityFromRows(vehicleCapacities, fallbackCapacity = 0) {
  if (!Array.isArray(vehicleCapacities) || vehicleCapacities.length === 0) {
    return Math.max(0, Number(fallbackCapacity) || 0);
  }
  const total = vehicleCapacities.reduce(
    (sum, row) => sum + Math.max(0, Number(row?.capacity) || 0),
    0
  );
  return total > 0 ? total : Math.max(0, Number(fallbackCapacity) || 0);
}

module.exports = {
  SETTING_KEY,
  isAutoCapacityEnabled,
  getActiveVehicleCount,
  getActiveVehicleCapacitySum,
  resolveSlotCapacity,
  recalculateFutureSlotCapacities,
  syncSlotVehicleCapacities,
  pruneInactiveSlotVehicleCapacities,
  computeLiveCapacityFromRows,
  assignMissingTrainerIds
};
