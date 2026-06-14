-- Phase 2: Offline booking reference, attendance, audit trail, timeline, capacity safety

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
    CREATE TYPE attendance_status_enum AS ENUM ('SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED');
  END IF;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offline_reference_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_status attendance_status_enum NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_updated_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_offline_reference_number
  ON bookings(offline_reference_number)
  WHERE offline_reference_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_attendance_status ON bookings(attendance_status);
CREATE INDEX IF NOT EXISTS idx_bookings_updated_by_admin_id ON bookings(updated_by_admin_id)
  WHERE updated_by_admin_id IS NOT NULL;

COMMENT ON COLUMN bookings.offline_reference_number IS 'Human-readable ref for offline bookings, e.g. OFF-000001';
COMMENT ON COLUMN bookings.attendance_status IS 'Attendance: SCHEDULED, ATTENDED, NO_SHOW, CANCELLED';

-- Offline reference sequence + generator
CREATE SEQUENCE IF NOT EXISTS offline_booking_reference_seq START 1;

CREATE OR REPLACE FUNCTION generate_offline_reference_number()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
  candidate TEXT;
BEGIN
  LOOP
    next_val := nextval('offline_booking_reference_seq');
    candidate := 'OFF-' || LPAD(next_val::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM bookings WHERE offline_reference_number = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- Slot flag when booked_count exceeds live active-vehicle capacity
ALTER TABLE slots ADD COLUMN IF NOT EXISTS capacity_exceeded BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN slots.capacity_exceeded IS 'True when booked_count > sum of active vehicle capacities';

-- Per-booking activity timeline
CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id
  ON booking_events(booking_id, created_at DESC);

COMMENT ON TABLE booking_events IS 'Chronological booking activity for admin timeline views';
