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

-- bookings: offline booking + source tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_source_enum') THEN
    CREATE TYPE booking_source_enum AS ENUM ('ONLINE', 'OFFLINE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'booking_source'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_source booking_source_enum NOT NULL DEFAULT 'ONLINE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'created_by_admin_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN created_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'offline_customer_name'
  ) THEN
    ALTER TABLE bookings ADD COLUMN offline_customer_name TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'offline_customer_age'
  ) THEN
    ALTER TABLE bookings ADD COLUMN offline_customer_age INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'offline_customer_gender'
  ) THEN
    ALTER TABLE bookings ADD COLUMN offline_customer_gender TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'trainer_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN trainer_id DROP NOT NULL;
  END IF;
END $$;

-- Phase 2 offline enhancements (reference, attendance, audit)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
    CREATE TYPE attendance_status_enum AS ENUM ('SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'offline_reference_number'
  ) THEN
    ALTER TABLE bookings ADD COLUMN offline_reference_number TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'attendance_status'
  ) THEN
    ALTER TABLE bookings ADD COLUMN attendance_status attendance_status_enum NOT NULL DEFAULT 'SCHEDULED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'attendance_updated_by'
  ) THEN
    ALTER TABLE bookings ADD COLUMN attendance_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'attendance_updated_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN attendance_updated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'updated_by_admin_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN updated_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'slots' AND column_name = 'capacity_exceeded'
  ) THEN
    ALTER TABLE slots ADD COLUMN capacity_exceeded BOOLEAN NOT NULL DEFAULT false;
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
