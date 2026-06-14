/**
 * Booking activity timeline events.
 */

const db = require('../db');

const EVENT_TYPES = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_UPDATED: 'BOOKING_UPDATED',
  TRAINER_ASSIGNED: 'TRAINER_ASSIGNED',
  VEHICLE_CHANGED: 'VEHICLE_CHANGED',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_COMPLETED: 'BOOKING_COMPLETED'
};

async function logBookingEvent(
  { bookingId, eventType, title, description = null, actorId = null, metadata = {} },
  client = null
) {
  const runner = client || db;
  try {
    await runner.query(
      `INSERT INTO booking_events (booking_id, event_type, title, description, actor_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [bookingId, eventType, title, description, actorId, JSON.stringify(metadata || {})]
    );
  } catch (error) {
    if (error.code === '42P01') return;
    console.error('[bookingEvent] Failed to log event:', error.message);
  }
}

async function getBookingTimeline(bookingId, client = null) {
  const runner = client || db;
  try {
    const result = await runner.query(
      `SELECT be.id, be.event_type, be.title, be.description, be.metadata, be.created_at,
              p.full_name AS actor_name, p.role AS actor_role
       FROM booking_events be
       LEFT JOIN profiles p ON be.actor_id = p.id
       WHERE be.booking_id = $1
       ORDER BY be.created_at ASC, be.id ASC`,
      [bookingId]
    );
    return result.rows;
  } catch (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
}

module.exports = {
  EVENT_TYPES,
  logBookingEvent,
  getBookingTimeline
};
