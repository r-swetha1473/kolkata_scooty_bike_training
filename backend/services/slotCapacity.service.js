/**
 * Slot capacity derived from active vehicle count when auto-calculation is enabled.
 */

const db = require('../db');
const { SLOT_CAPACITY } = require('../config/app.config');
const auditService = require('./audit.service');

const SETTING_KEY = 'auto_slot_capacity_from_vehicles';

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

/**
 * Updates capacity on future slots where booked_count allows it.
 */
async function recalculateFutureSlotCapacities(adminId = null, client = null) {
  const enabled = await isAutoCapacityEnabled(client);
  const capacity = enabled ? Math.max(1, await getActiveVehicleCount(client)) : SLOT_CAPACITY.DEFAULT;

  const result = await query(
    client,
    `
    UPDATE slots
    SET capacity = $1,
        updated_at = NOW(),
        status = CASE
          WHEN booked_count >= $1 THEN 'full'
          WHEN booked_count = 0 THEN status
          ELSE CASE WHEN status = 'full' THEN 'available' ELSE status END
        END
    WHERE start_time > NOW()
      AND booked_count <= $1
    RETURNING id
    `,
    [capacity]
  );

  if (adminId && result.rows.length > 0) {
    await auditService.logSlotCapacityUpdate(adminId, {
      auto_enabled: enabled,
      new_capacity: capacity,
      slots_updated: result.rows.length
    });
  }

  return { updated: result.rows.length, capacity, auto_enabled: enabled };
}

module.exports = {
  SETTING_KEY,
  isAutoCapacityEnabled,
  getActiveVehicleCount,
  resolveSlotCapacity,
  recalculateFutureSlotCapacities
};
