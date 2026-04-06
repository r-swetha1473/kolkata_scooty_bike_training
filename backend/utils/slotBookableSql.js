/**
 * Shared SQL predicate: slots a customer may book (24h window, capacity, trainer ready).
 * Keep in sync with bookingValidation.service booking window rules.
 */
const { SLOT_VISIBILITY_HOURS } = require('../config/app.config');

/**
 * @param {string} alias Table alias for slots (default "s")
 * @returns {string} SQL fragment (no leading AND)
 */
function sqlBookableSlotConditions(alias = 's') {
  const a = alias;
  return `
    ${a}.start_time > NOW()
    AND ${a}.start_time <= (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours')
    AND ${a}.booked_count < ${a}.capacity
    AND ${a}.status NOT IN ('disabled', 'cancelled')
    AND ${a}.trainer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM trainers t
      WHERE t.id = ${a}.trainer_id AND t.is_active IS TRUE
    )
  `;
}

module.exports = {
  sqlBookableSlotConditions
};
