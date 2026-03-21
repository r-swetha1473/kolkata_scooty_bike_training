-- Add bookings.phone when DB predates phase2 migration (e.g. Neon without full migration set).
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'phone'
  ) THEN
    ALTER TABLE bookings ADD COLUMN phone TEXT;
    COMMENT ON COLUMN bookings.phone IS '10-digit mobile used for this booking (phone-based validation)';
  END IF;
END $$;

-- Backfill from profile when possible (last 10 digits)
UPDATE bookings b
SET phone = right(regexp_replace(p.phone, '\D', '', 'g'), 10)
FROM profiles p
WHERE b.user_id = p.id
  AND b.phone IS NULL
  AND p.phone IS NOT NULL
  AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 10;

CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_phone_created_week
  ON bookings(phone, created_at)
  WHERE phone IS NOT NULL AND status NOT IN ('cancelled');
