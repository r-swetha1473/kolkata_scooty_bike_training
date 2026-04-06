-- Customer inactivity blocking (45 days without a booking)
-- last_booking_date may already exist from earlier migrations

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS inactive_blocked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.inactive_blocked IS 'Set true when customer has no booking activity for 45 days; admin can clear.';

CREATE INDEX IF NOT EXISTS idx_profiles_inactive_blocked_customers
  ON profiles (inactive_blocked)
  WHERE role = 'customer' AND inactive_blocked = true;
