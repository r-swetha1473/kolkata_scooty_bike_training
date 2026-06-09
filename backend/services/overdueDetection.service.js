/**
 * Detect overdue bookings and create admin notifications + audit entries.
 */

const overdueBookingService = require('./overdueBooking.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

async function runOverdueBookingDetection() {
  const overdue = await overdueBookingService.listOverdueBookings(50);
  let created = 0;

  for (const row of overdue) {
    const customer = row.customer_name || 'Customer';
    const slotLabel = row.start_time
      ? new Date(row.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : 'past slot';

    const n = await notificationService.createNotification({
      type: 'expired_booking',
      title: 'Booking requires action',
      body: `${customer} — ${slotLabel} (${row.status}). Mark as completed or cancelled.`,
      entity_type: 'booking',
      entity_id: row.id,
      dedupeHours: 12
    });
    if (n && n.id) created += 1;
  }

  if (overdue.length > 0) {
    await auditService.logExpiredBookingDetection(null, {
      overdue_count: overdue.length,
      notifications_created: created
    });
  }

  return { overdueCount: overdue.length, notificationsCreated: created };
}

module.exports = { runOverdueBookingDetection };
