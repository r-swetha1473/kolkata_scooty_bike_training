const db = require('../db');
const emailService = require('./email.service');

const INACTIVITY_DAYS = parseInt(process.env.INACTIVITY_BLOCK_DAYS || '45', 10);

/**
 * Marks customers inactive when they have not made a booking in INACTIVITY_DAYS.
 * Uses last_booking_date when set; otherwise uses account created_at date for never-booked users.
 * @returns {Promise<{ blocked: import('pg').QueryResultRow[] }>}
 */
async function runInactivityBlockCheck() {
  const result = await db.query(
    `UPDATE profiles p
     SET inactive_blocked = true, updated_at = NOW()
     WHERE p.role = 'customer'
       AND p.inactive_blocked IS NOT TRUE
       AND (
         (p.last_booking_date IS NOT NULL
          AND p.last_booking_date < (CURRENT_DATE - $1::int))
         OR
         (p.last_booking_date IS NULL
          AND (p.created_at AT TIME ZONE 'UTC')::date < (CURRENT_DATE - $1::int))
       )
     RETURNING id, email, full_name, phone, last_booking_date, created_at`,
    [INACTIVITY_DAYS]
  );

  const blocked = result.rows || [];
  if (blocked.length > 0) {
    await emailService.sendAdminInactivityBlockAlert(blocked, INACTIVITY_DAYS).catch((err) => {
      console.error('[Inactivity] Admin alert email failed:', err.message);
    });
  }

  return { blocked };
}

module.exports = {
  runInactivityBlockCheck,
  INACTIVITY_DAYS
};
