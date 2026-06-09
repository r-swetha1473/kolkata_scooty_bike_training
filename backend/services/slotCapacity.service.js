/**
 * Slot capacity derived from active vehicle count when auto-calculation is enabled.
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

/**
 * Resolves slot capacity for new/updated slots.
 * When auto mode is on: capacity = count of active vehicles (minimum 1).
 */
async function resolveSlotCapacity(client = null) {
  const enabled = await isAutoCapacityEnabled(client);
  if (!enabled) {
    return SLOT_CAPACITY.DEFAULT;
  }
  const count = await getActiveVehicleCount(client);
  return Math.max(1, count);
}

async function syncSlotVehicleCapacities(slotIds, client = null) {
  for (const slotId of slotIds) {
    try {
      await query(client, 'SELECT ensure_slot_vehicle_capacities($1)', [slotId]);
    } catch (e) {
      const msg = String(e.message || '');
      if (!msg.includes('does not exist') && !msg.includes('ensure_slot_vehicle_capacities')) {
        console.warn('[slotCapacity] ensure_slot_vehicle_capacities:', msg);
      }
    }
  }
}

/**
 * Updates capacity on all slots from today (Asia/Kolkata) onward.
 * Includes today's in-progress slots (uses slot day, not start_time > NOW()).
 */
async function recalculateFutureSlotCapacities(adminId = null, client = null) {
  const enabled = await isAutoCapacityEnabled(client);
  const vehicleCount = await getActiveVehicleCount(client);
  const capacity = enabled ? Math.max(1, vehicleCount) : SLOT_CAPACITY.DEFAULT;

  const result = await query(
    client,
    `
    UPDATE slots
    SET capacity = $1,
        updated_at = NOW(),
        status = CASE
          WHEN status IN ('cancelled', 'completed', 'disabled') THEN status
          WHEN booked_count >= $1 THEN 'full'
          ELSE 'available'
        END
    WHERE ${SLOT_DAY} >= ${KOLKATA_TODAY}
    RETURNING id
    `,
    [capacity]
  );

  const slotIds = result.rows.map((r) => r.id);
  if (slotIds.length > 0) {
    await syncSlotVehicleCapacities(slotIds, client);
  }

  if (result.rows.length > 0) {
    await auditService.logSlotCapacityUpdate(adminId, {
      auto_enabled: enabled,
      new_capacity: capacity,
      active_vehicles: vehicleCount,
      slots_updated: result.rows.length
    });
    await notificationService.createNotification({
      type: 'slot_capacity',
      title: 'Slot capacity updated',
      body: `${result.rows.length} slot(s) from today onward set to capacity ${capacity} (${vehicleCount} active vehicle(s)).`,
      entity_type: 'slot',
      entity_id: null,
      dedupeHours: 1
    }).catch(() => {});
  }

  return {
    updated: result.rows.length,
    capacity,
    active_vehicles: vehicleCount,
    auto_enabled: enabled
  };
}

module.exports = {
  SETTING_KEY,
  isAutoCapacityEnabled,
  getActiveVehicleCount,
  resolveSlotCapacity,
  recalculateFutureSlotCapacities,
  syncSlotVehicleCapacities
};
