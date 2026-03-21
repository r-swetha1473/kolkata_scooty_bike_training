const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');

/**
 * Normalize POST /api/bookings JSON so validation and handlers always see snake_case strings.
 * - Accepts camelCase aliases (slotId, trainerId, vehicleId)
 * - Coerces UUID-like fields to trimmed strings (express-validator .trim() requires strings)
 * - Ignores user_id / userId from client (booking user always comes from JWT)
 */
function normalizeBookingCreateBody(req, res, next) {
  const raw = req.body;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    req.body = {};
    return next();
  }

  const b = { ...raw };

  delete b.user_id;
  delete b.userId;

  if (b.slot_id == null && b.slotId != null) b.slot_id = b.slotId;
  if (b.trainer_id == null && b.trainerId != null) b.trainer_id = b.trainerId;
  if (b.vehicle_id == null && b.vehicleId != null) b.vehicle_id = b.vehicleId;

  for (const key of ['slot_id', 'trainer_id', 'vehicle_id']) {
    const v = b[key];
    if (v === undefined || v === null) continue;
    b[key] = String(v).trim();
  }

  if (b.phone != null && b.phone !== '') {
    b.phone = normalizeIndianMobileDigits(b.phone);
  }

  if (b.notes != null && typeof b.notes !== 'string') {
    b.notes = String(b.notes);
  }
  if (typeof b.notes === 'string') {
    b.notes = b.notes.trim();
  }

  req.body = b;
  next();
}

module.exports = { normalizeBookingCreateBody };
