/**
 * Vehicle Service
 * Provides dynamic vehicle management without hardcoded types
 */

const db = require('../db');

/**
 * Get all active vehicles
 * @returns {Promise<Array>} Array of vehicle objects
 */
async function getActiveVehicles() {
  const result = await db.query(
    'SELECT id, name, max_per_slot, is_active FROM vehicles WHERE is_active = true ORDER BY name'
  );
  return result.rows;
}

/**
 * Get vehicle by ID
 * @param {string} vehicleId - Vehicle UUID
 * @returns {Promise<Object|null>} Vehicle object or null
 */
async function getVehicleById(vehicleId) {
  const result = await db.query(
    'SELECT id, name, max_per_slot, is_active FROM vehicles WHERE id = $1',
    [vehicleId]
  );
  return result.rows[0] || null;
}

/**
 * Get vehicle capacity for a slot
 * Returns the max_per_slot for a given vehicle
 * @param {string} vehicleId - Vehicle UUID
 * @returns {Promise<number>} Max capacity per slot for this vehicle
 */
async function getVehicleCapacity(vehicleId) {
  const vehicle = await getVehicleById(vehicleId);
  return vehicle ? vehicle.max_per_slot : 0;
}

/**
 * Get booked count for a vehicle in a slot
 * @param {string} slotId - Slot UUID
 * @param {string} vehicleId - Vehicle UUID
 * @returns {Promise<number>} Number of bookings for this vehicle in this slot
 */
async function getVehicleBookedCount(slotId, vehicleId) {
  const result = await db.query(
    `SELECT COUNT(*) as count 
     FROM bookings 
     WHERE slot_id = $1 AND vehicle_id = $2 AND status NOT IN ('cancelled')`,
    [slotId, vehicleId]
  );
  return parseInt(result.rows[0]?.count || 0, 10);
}

/**
 * Per-slot capacity from slot_vehicle_capacity when present, else vehicles.max_per_slot
 */
async function getEffectiveCapacityForSlot(slotId, vehicleId) {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle || !vehicle.is_active) {
    return 0;
  }

  try {
    const svc = await db.query(
      `SELECT capacity FROM slot_vehicle_capacity 
       WHERE slot_id = $1 AND vehicle_id = $2`,
      [slotId, vehicleId]
    );
    if (svc.rows.length > 0) {
      return parseInt(svc.rows[0].capacity, 10) || vehicle.max_per_slot;
    }
  } catch (e) {
    if (e.code !== '42P01') {
      throw e;
    }
  }

  return vehicle.max_per_slot;
}

/**
 * Check if vehicle has available capacity in a slot
 * @param {string} slotId - Slot UUID
 * @param {string} vehicleId - Vehicle UUID
 * @returns {Promise<{available: boolean, capacity: number, booked: number}>}
 */
async function checkVehicleAvailability(slotId, vehicleId) {
  const vehicle = await getVehicleById(vehicleId);
  if (!vehicle || !vehicle.is_active) {
    return { available: false, capacity: 0, booked: 0 };
  }

  const booked = await getVehicleBookedCount(slotId, vehicleId);
  const capacity = await getEffectiveCapacityForSlot(slotId, vehicleId);

  return {
    available: booked < capacity,
    capacity,
    booked
  };
}

module.exports = {
  getActiveVehicles,
  getVehicleById,
  getVehicleCapacity,
  getVehicleBookedCount,
  getEffectiveCapacityForSlot,
  checkVehicleAvailability
};
