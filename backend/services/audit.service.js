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

/**
 * Log trainer deletion
 */
async function logTrainerDelete(adminId, trainerData, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'DELETE_TRAINER',
    entityType: 'trainer',
    entityId: trainerData.id,
    beforeValue: {
      id: trainerData.id,
      user_id: trainerData.user_id,
      full_name: trainerData.full_name,
      is_active: trainerData.is_active
    },
    afterValue: null,
    details
  });
}

/**
 * Log bulk completion of trainer bookings before deletion
 */
async function logTrainerBookingsBulkComplete(adminId, trainerId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'COMPLETE_TRAINER_BOOKINGS',
    entityType: 'trainer',
    entityId: trainerId,
    beforeValue: null,
    afterValue: { status: 'completed', updatedCount: details.updatedCount },
    details
  });
}

/**
 * Log reassignment of trainer bookings before deletion
 */
async function logTrainerBookingsReassign(adminId, fromTrainerId, toTrainerId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'REASSIGN_TRAINER_BOOKINGS',
    entityType: 'trainer',
    entityId: fromTrainerId,
    beforeValue: { trainer_id: fromTrainerId },
    afterValue: { trainer_id: toTrainerId },
    details: { toTrainerId, ...details }
  });
}

async function logBookingStatusChange(adminId, bookingId, beforeData, afterStatus) {
  await logAdminAction({
    adminId,
    actionType: 'UPDATE_BOOKING_STATUS',
    entityType: 'booking',
    entityId: bookingId,
    beforeValue: { id: bookingId, status: beforeData.status },
    afterValue: { id: bookingId, status: afterStatus },
    details: { changed_fields: ['status'] }
  });
}

async function logBookingDelete(adminId, bookingData) {
  await logAdminAction({
    adminId,
    actionType: 'DELETE_BOOKING',
    entityType: 'booking',
    entityId: bookingData.id,
    beforeValue: bookingData,
    afterValue: null,
    details: { reason: 'admin_hard_delete' }
  });
}

async function logTrainerCreate(adminId, trainerData) {
  await logAdminAction({
    adminId,
    actionType: 'CREATE_TRAINER',
    entityType: 'trainer',
    entityId: trainerData.id,
    beforeValue: null,
    afterValue: trainerData,
    details: {}
  });
}

async function logTrainerUpdate(adminId, trainerId, beforeData, afterData) {
  await logAdminAction({
    adminId,
    actionType: 'UPDATE_TRAINER',
    entityType: 'trainer',
    entityId: trainerId,
    beforeValue: beforeData,
    afterValue: afterData,
    details: { changed_fields: getChangedFields(beforeData, afterData) }
  });
}

async function logSettingsUpdate(adminId, beforeSettings, afterSettings) {
  await logAdminAction({
    adminId,
    actionType: 'UPDATE_SETTINGS',
    entityType: 'settings',
    entityId: null,
    beforeValue: beforeSettings,
    afterValue: afterSettings,
    details: { changed_keys: Object.keys(afterSettings || {}) }
  });
}

async function logAuthEvent(userId, actionType, details = {}, ipAddress = null) {
  await logAdminAction({
    adminId: userId || null,
    actionType,
    entityType: 'auth',
    entityId: userId,
    beforeValue: null,
    afterValue: null,
    details: { ...details, ip_address: ipAddress }
  });
}

async function logBookingCreate(userId, bookingData) {
  await logAdminAction({
    adminId: userId,
    actionType: 'BOOKING_CREATED',
    entityType: 'booking',
    entityId: bookingData.id,
    beforeValue: null,
    afterValue: {
      id: bookingData.id,
      user_id: bookingData.user_id,
      slot_id: bookingData.slot_id,
      trainer_id: bookingData.trainer_id,
      vehicle_id: bookingData.vehicle_id,
      status: bookingData.status
    },
    details: { source: 'customer_booking' }
  });
}

async function logPasswordReset(adminId, targetUserId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: targetUserId,
    beforeValue: null,
    afterValue: null,
    details: {
      target_user_id: targetUserId,
      actor_user_id: adminId,
      ...details
    }
  });
}

async function logPasswordChanged(userId, ipAddress = null) {
  await logAdminAction({
    adminId: userId,
    actionType: 'PASSWORD_CHANGED',
    entityType: 'auth',
    entityId: userId,
    beforeValue: null,
    afterValue: null,
    details: { ip_address: ipAddress }
  });
}

async function logSlotCapacityUpdate(adminId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'AUTO_SLOT_CAPACITY_UPDATED',
    entityType: 'slot',
    entityId: null,
    beforeValue: null,
    afterValue: null,
    details
  });
}

async function logNotificationCreated(adminId, notification) {
  await logAdminAction({
    adminId,
    actionType: 'NOTIFICATION_CREATED',
    entityType: 'notification',
    entityId: notification?.id || null,
    beforeValue: null,
    afterValue: {
      type: notification?.type,
      title: notification?.title,
      entity_type: notification?.entity_type,
      entity_id: notification?.entity_id
    },
    details: { source: 'system' }
  });
}

async function logNotificationRead(adminId, notificationId) {
  await logAdminAction({
    adminId,
    actionType: 'NOTIFICATION_READ',
    entityType: 'notification',
    entityId: notificationId,
    beforeValue: null,
    afterValue: null,
    details: { admin_id: adminId }
  });
}

async function logExpiredBookingDetection(adminId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'EXPIRED_BOOKING_DETECTED',
    entityType: 'booking',
    entityId: null,
    beforeValue: null,
    afterValue: null,
    details
  });
}

async function logBookingCompleted(adminId, bookingId, details = {}) {
  await logAdminAction({
    adminId,
    actionType: 'BOOKING_COMPLETED',
    entityType: 'booking',
    entityId: bookingId,
    beforeValue: null,
    afterValue: details,
    details: { source: details.source || 'admin' }
  });
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
  logUserBookingCancellation,
  logTrainerDelete,
  logTrainerBookingsBulkComplete,
  logTrainerBookingsReassign,
  logBookingStatusChange,
  logBookingDelete,
  logTrainerCreate,
  logTrainerUpdate,
  logSettingsUpdate,
  logAuthEvent,
  logBookingCreate,
  logPasswordReset,
  logPasswordChanged,
  logSlotCapacityUpdate,
  logNotificationCreated,
  logNotificationRead,
  logExpiredBookingDetection,
  logBookingCompleted
};
