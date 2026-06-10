-- Idempotent safety net for databases that skipped an incremental migration.
-- Does not remove columns or weaken constraints; only adds missing pieces.

-- bookings: vehicle_id, phone (slot_id, trainer_id, status are in base schema)
DO $$
BEGIN
  IF to_regclass('public.vehicles') IS NOT NULL
     AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'vehicle_id'
    ) THEN
    ALTER TABLE bookings ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON bookings(vehicle_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'phone'
  ) THEN
    ALTER TABLE bookings ADD COLUMN phone TEXT;
    CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone) WHERE phone IS NOT NULL;
  END IF;
END $$;

-- slots: is_visible used by API (may exist from earlier migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'slots' AND column_name = 'is_visible'
  ) THEN
    ALTER TABLE slots ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_slots_is_visible ON slots(is_visible) WHERE is_visible = true;
  END IF;
END $$;

-- profiles: stats columns used by GET /api/admin/users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'total_bookings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN total_bookings INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_booking_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_booking_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weekly_booking_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN weekly_booking_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weekly_reset_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN weekly_reset_date DATE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'inactive_blocked'
  ) THEN
    ALTER TABLE profiles ADD COLUMN inactive_blocked BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN provider_id TEXT;
  END IF;
END $$;

-- student_entitlements core columns
DO $$
BEGIN
  IF to_regclass('public.student_entitlements') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'student_entitlements' AND column_name = 'used_slots'
    ) THEN
      ALTER TABLE student_entitlements ADD COLUMN used_slots INTEGER NOT NULL DEFAULT 0 CHECK (used_slots >= 0);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'student_entitlements' AND column_name = 'total_slots'
    ) THEN
      ALTER TABLE student_entitlements ADD COLUMN total_slots INTEGER NOT NULL DEFAULT 0 CHECK (total_slots >= 0);
    END IF;
  END IF;
END $$;
