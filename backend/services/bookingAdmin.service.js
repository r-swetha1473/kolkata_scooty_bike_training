/**
 * Admin booking detail with audit metadata and timeline.
 */

const db = require('../db');
const { getBookingTimeline } = require('./bookingEvent.service');
const { getCustomerHistory } = require('./customerHistory.service');
const { enrichBookingTimes } = require('../utils/bookingTimeFormat');

const BOOKING_DETAIL_SQL = `
  SELECT b.*,
         s.start_time, s.end_time, s.slot_date, s.capacity AS slot_capacity,
         s.booked_count AS slot_booked_count, s.capacity_exceeded,
         u.full_name AS user_name, u.email AS user_email,
         creator.full_name AS created_by_admin_name, creator.role AS created_by_admin_role,
         updater.full_name AS updated_by_admin_name, updater.role AS updated_by_admin_role,
         attendance_updater.full_name AS attendance_updated_by_name,
         attendance_updater.role AS attendance_updated_by_role,
         t.id AS trainer_table_id, tp.full_name AS trainer_name,
         v.name AS vehicle_name
  FROM bookings b
  LEFT JOIN slots s ON b.slot_id = s.id
  LEFT JOIN profiles u ON b.user_id = u.id
  LEFT JOIN profiles creator ON b.created_by_admin_id = creator.id
  LEFT JOIN profiles updater ON b.updated_by_admin_id = updater.id
  LEFT JOIN profiles attendance_updater ON b.attendance_updated_by = attendance_updater.id
  LEFT JOIN trainers t ON b.trainer_id = t.id
  LEFT JOIN profiles tp ON t.user_id = tp.id
  LEFT JOIN vehicles v ON b.vehicle_id = v.id
  WHERE b.id = $1
`;

function buildAuditTrail(row) {
  const isOffline = row.booking_source === 'OFFLINE';
  return {
    created_by: isOffline
      ? row.created_by_admin_name || 'Admin'
      : row.user_name || 'Self',
    created_by_role: isOffline ? row.created_by_admin_role : 'customer',
    created_at: row.created_at,
    updated_by: row.updated_by_admin_name || null,
    updated_by_role: row.updated_by_admin_role || null,
    updated_at: row.updated_at,
    attendance_updated_by: row.attendance_updated_by_name || null,
    attendance_updated_by_role: row.attendance_updated_by_role || null,
    attendance_updated_at: row.attendance_updated_at
  };
}

async function getBookingDetail(bookingId) {
  const result = await db.query(BOOKING_DETAIL_SQL, [bookingId]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const timeline = await getBookingTimeline(bookingId);
  const customerHistory = await getCustomerHistory({
    userId: row.user_id,
    phone: row.phone,
    offlineCustomerName: row.offline_customer_name
  });

  const customerName =
    row.booking_source === 'OFFLINE'
      ? row.offline_customer_name || 'Walk-in customer'
      : row.user_name || 'N/A';

  return enrichBookingTimes({
    id: row.id,
    user_id: row.user_id,
    slot_id: row.slot_id,
    trainer_id: row.trainer_id,
    vehicle_id: row.vehicle_id,
    status: row.status,
    notes: row.notes,
    phone: row.phone,
    booking_source: row.booking_source || 'ONLINE',
    offline_reference_number: row.offline_reference_number,
    offline_customer_name: row.offline_customer_name,
    offline_customer_age: row.offline_customer_age,
    offline_customer_gender: row.offline_customer_gender,
    attendance_status: row.attendance_status || 'SCHEDULED',
    created_at: row.created_at,
    updated_at: row.updated_at,
    start_time: row.start_time,
    end_time: row.end_time,
    slot_date: row.slot_date,
    vehicle_name: row.vehicle_name,
    trainer_name: row.trainer_name,
    user_name: row.user_name,
    user_email: row.user_email,
    slot: {
      start_time: row.start_time,
      end_time: row.end_time,
      slot_date: row.slot_date,
      capacity: row.slot_capacity,
      booked_count: row.slot_booked_count,
      capacity_exceeded: row.capacity_exceeded
    },
    audit: buildAuditTrail(row),
    timeline,
    customer: {
      name: customerName,
      phone: row.phone || null,
      source: row.booking_source === 'OFFLINE' ? 'Offline' : 'Online'
    },
    customer_history: customerHistory
  });
}

module.exports = {
  getBookingDetail,
  BOOKING_DETAIL_SQL
};
