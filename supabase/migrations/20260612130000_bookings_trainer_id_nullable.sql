-- Allow customer bookings without trainer assignment (capacity is vehicle/slot based).
-- Commit 44203e5 inserts trainer_id = NULL; production had NOT NULL on bookings.trainer_id.

ALTER TABLE bookings ALTER COLUMN trainer_id DROP NOT NULL;

COMMENT ON COLUMN bookings.trainer_id IS 'Optional trainer assignment; NULL for customer self-service bookings until admin assigns';
