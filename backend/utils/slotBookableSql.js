/**
 * Shared SQL predicate: slots a customer may book (capacity, trainer ready).
 * Keep in sync with bookingValidation.service booking window rules.
 */
const { SLOT_VISIBILITY_HOURS } = require('../config/app.config');

/**
 * @param {string} alias Table alias for slots (default "s")
 * @param {{ dateScoped?: boolean }} [options]
 *   dateScoped: when true (GET /date/:date?bookable_only), do not apply the global 24h upper window
 * @returns {string} SQL fragment (no leading AND)
 */
function sqlBookableSlotConditions(alias = 's', options = {}) {
  const a = alias;
  const dateScoped = options.dateScoped === true;
  const visibilityUpper = dateScoped
    ? ''
    : `AND ${a}.start_time <= (NOW() + INTERVAL '${SLOT_VISIBILITY_HOURS} hours')`;

  return `
    ${a}.start_time > NOW()
    ${visibilityUpper}
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
