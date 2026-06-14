/**
 * Admin attendance updates — separate from booking status workflow.
 */

const db = require('../db');
const auditService = require('./audit.service');
const { EVENT_TYPES, logBookingEvent } = require('./bookingEvent.service');

const VALID_ATTENDANCE = ['SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED'];

const ATTENDANCE_LABELS = {
  SCHEDULED: 'Scheduled',
  ATTENDED: 'Attended',
  NO_SHOW: 'No Show',
  CANCELLED: 'Cancelled'
};

async function updateBookingAttendance(adminId, bookingId, attendanceStatus) {
  const normalized = String(attendanceStatus || '').trim().toUpperCase();
  if (!VALID_ATTENDANCE.includes(normalized)) {
    const error = new Error(`Invalid attendance status. Must be one of: ${VALID_ATTENDANCE.join(', ')}`);
    error.status = 400;
    error.errorCode = 'INVALID_ATTENDANCE';
    throw error;
  }

  const before = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (before.rows.length === 0) {
    const error = new Error('Booking not found');
    error.status = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  const oldStatus = before.rows[0].attendance_status || 'SCHEDULED';

  const result = await db.query(
    `UPDATE bookings
     SET attendance_status = $1::attendance_status_enum,
         attendance_updated_by = $2,
         attendance_updated_at = NOW(),
         updated_by_admin_id = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [normalized, adminId, bookingId]
  );

  const updated = result.rows[0];

  await auditService.logAdminAction({
    adminId,
    actionType: 'UPDATE_BOOKING_ATTENDANCE',
    entityType: 'booking',
    entityId: bookingId,
    beforeValue: { attendance_status: oldStatus },
    afterValue: { attendance_status: normalized },
    details: { source: 'admin_attendance_update' }
  });

  await logBookingEvent({
    bookingId,
    eventType: EVENT_TYPES.ATTENDANCE_MARKED,
    title: 'Attendance Marked',
    description: `${ATTENDANCE_LABELS[normalized] || normalized}`,
    actorId: adminId,
    metadata: { from: oldStatus, to: normalized }
  });

  return updated;
}

module.exports = {
  VALID_ATTENDANCE,
  ATTENDANCE_LABELS,
  updateBookingAttendance
};
