/**
 * Audit Logging Service
 * Centralized service for logging admin actions
 */

const db = require('../db');

/**
 * Log an admin action to the audit log
 * @param {Object} params - Audit log parameters
 * @param {string} params.adminId - Admin user ID
 * @param {string} params.actionType - Action type (e.g., 'CREATE_SLOT', 'UPDATE_VEHICLE', 'CANCEL_BOOKING')
 * @param {string} params.entityType - Entity type (e.g., 'slot', 'vehicle', 'booking')
 * @param {string} params.entityId - Entity ID (UUID)
 * @param {Object} params.beforeValue - State before change (will be converted to JSONB)
 * @param {Object} params.afterValue - State after change (will be converted to JSONB)
 * @param {Object} params.details - Additional details (will be converted to JSONB)
 * @returns {Promise<void>}
 */
async function logAdminAction({ adminId, actionType, entityType, entityId, beforeValue = null, afterValue = null, details = null }) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, entity_type, entity_id, before_value, after_value, details)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [
        adminId,
        actionType,
        entityType,
        entityId,
        beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue ? JSON.stringify(afterValue) : null,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main operation
    console.error('[Audit] Failed to log admin action:', error);
  }
}

/**
 * Log slot creation
 */
async function logSlotCreate(adminId, slotData) {
  await logAdminAction({
    adminId,
    actionType: 'CREATE_SLOT',
    entityType: 'slot',
    entityId: slotData.id,
    beforeValue: null,
    afterValue: {
      id: slotData.id,
      trainer_id: slotData.trainer_id,
      start_time: slotData.start_time,
      end_time: slotData.end_time,
      slot_date: slotData.slot_date,
      capacity: slotData.capacity,
      status: slotData.status,
      is_auto_generated: slotData.is_auto_generated,
      is_visible: slotData.is_visible
    },
    details: { source: 'admin_manual_create' }
  });
}

/**
 * Log slot update
 */
async function logSlotUpdate(adminId, slotId, beforeData, afterData) {
  await logAdminAction({
    adminId,
    actionType: 'UPDATE_SLOT',
    entityType: 'slot',
    entityId: slotId,
    beforeValue: beforeData,
    afterValue: afterData,
    details: { changed_fields: getChangedFields(beforeData, afterData) }
  });
}

/**
 * Log slot deletion
 */
async function logSlotDelete(adminId, slotData) {
  await logAdminAction({
    adminId,
    actionType: 'DELETE_SLOT',
    entityType: 'slot',
    entityId: slotData.id,
    beforeValue: {
      id: slotData.id,
      trainer_id: slotData.trainer_id,
      start_time: slotData.start_time,
      end_time: slotData.end_time,
      slot_date: slotData.slot_date,
      capacity: slotData.capacity,
      booked_count: slotData.booked_count,
      status: slotData.status
    },
    afterValue: null,
    details: { reason: 'admin_deletion' }
  });
}

/**
 * Log vehicle creation
 */
async function logVehicleCreate(adminId, vehicleData) {
  await logAdminAction({
    adminId,
    actionType: 'CREATE_VEHICLE',
    entityType: 'vehicle',
    entityId: vehicleData.id,
    beforeValue: null,
    afterValue: {
      id: vehicleData.id,
      name: vehicleData.name,
      max_per_slot: vehicleData.max_per_slot,
      is_active: vehicleData.is_active
    },
    details: {}
  });
}

/**
 * Log vehicle update
 */
async function logVehicleUpdate(adminId, vehicleId, beforeData, afterData) {
  await logAdminAction({
    adminId,
    actionType: 'UPDATE_VEHICLE',
    entityType: 'vehicle',
    entityId: vehicleId,
    beforeValue: beforeData,
    afterValue: afterData,
    details: { changed_fields: getChangedFields(beforeData, afterData) }
  });
}

/**
 * Log vehicle deletion
 */
async function logVehicleDelete(adminId, vehicleData) {
  await logAdminAction({
    adminId,
    actionType: 'DELETE_VEHICLE',
    entityType: 'vehicle',
    entityId: vehicleData.id,
    beforeValue: {
      id: vehicleData.id,
      name: vehicleData.name,
      max_per_slot: vehicleData.max_per_slot,
      is_active: vehicleData.is_active
    },
    afterValue: null,
    details: {}
  });
}

/**
 * Log booking cancellation (admin-initiated)
 */
async function logBookingCancellation(adminId, bookingId, bookingData, reason) {
  await logAdminAction({
    adminId,
    actionType: 'CANCEL_BOOKING',
    entityType: 'booking',
    entityId: bookingId,
    beforeValue: {
      id: bookingData.id,
      user_id: bookingData.user_id,
      slot_id: bookingData.slot_id,
      vehicle_id: bookingData.vehicle_id,
      status: bookingData.status
    },
    afterValue: {
      id: bookingData.id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: adminId,
      cancellation_reason: reason
    },
    details: { 
      reason: reason,
      cancelled_by_admin: true
    }
  });
}

/**
 * Log customer-initiated cancellation (actor is the user's profile id)
 */
async function logUserBookingCancellation(userId, bookingId, bookingData, reason) {
  await logAdminAction({
    adminId: userId,
    actionType: 'USER_CANCEL_BOOKING',
    entityType: 'booking',
    entityId: bookingId,
    beforeValue: {
      id: bookingData.id,
      user_id: bookingData.user_id,
      slot_id: bookingData.slot_id,
      vehicle_id: bookingData.vehicle_id,
      status: bookingData.status
    },
    afterValue: {
      id: bookingData.id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancellation_reason: reason
    },
    details: {
      reason: reason || null,
      cancelled_by_customer: true
    }
  });
}

/**
 * Helper function to get changed fields between two objects
 */
function getChangedFields(before, after) {
  if (!before || !after) return [];
  
  const changed = [];
  for (const key in after) {
    if (before[key] !== after[key]) {
      changed.push(key);
    }
  }
  return changed;
}

module.exports = {
  logAdminAction,
  logSlotCreate,
  logSlotUpdate,
  logSlotDelete,
  logVehicleCreate,
  logVehicleUpdate,
  logVehicleDelete,
  logBookingCancellation,
  logUserBookingCancellation
};
