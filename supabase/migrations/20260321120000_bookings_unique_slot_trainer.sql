-- One non-cancelled booking per (slot_id, trainer_id): parallel sessions use different trainers.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot_trainer_active
ON bookings (slot_id, trainer_id)
WHERE trainer_id IS NOT NULL AND status NOT IN ('cancelled');

COMMENT ON INDEX idx_bookings_slot_trainer_active IS
  'Prevents assigning the same trainer to more than one active booking for the same time slot.';
