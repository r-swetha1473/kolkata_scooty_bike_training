-- Offline admin bookings + booking source tracking
-- Live capacity: prune inactive vehicle rows from future slots

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_source_enum') THEN
    CREATE TYPE booking_source_enum AS ENUM ('ONLINE', 'OFFLINE');
  END IF;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_source booking_source_enum NOT NULL DEFAULT 'ONLINE';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offline_customer_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offline_customer_age INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS offline_customer_gender TEXT;

COMMENT ON COLUMN bookings.booking_source IS 'ONLINE = customer self-booking; OFFLINE = admin walk-in booking';
COMMENT ON COLUMN bookings.created_by_admin_id IS 'Admin/subadmin who created an offline booking';
COMMENT ON COLUMN bookings.offline_customer_name IS 'Walk-in customer name for offline bookings';

-- Allow offline bookings without a linked profile
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

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_identity_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_source_identity_check CHECK (
  (booking_source = 'ONLINE' AND user_id IS NOT NULL)
  OR (
    booking_source = 'OFFLINE'
    AND offline_customer_name IS NOT NULL
    AND TRIM(offline_customer_name) <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_bookings_booking_source ON bookings(booking_source);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by_admin_id ON bookings(created_by_admin_id)
  WHERE created_by_admin_id IS NOT NULL;

-- Infer vehicle_type from vehicle_id when omitted (backward compatible with existing inserts)
CREATE OR REPLACE FUNCTION set_booking_vehicle_type_from_vehicle()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NEW.vehicle_type IS NOT NULL OR NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_name FROM vehicles WHERE id = NEW.vehicle_id;
  IF v_name IS NULL THEN
    NEW.vehicle_type := 'ELECTRIC'::vehicle_type_enum;
    RETURN NEW;
  END IF;

  IF v_name ILIKE '%petrol%' THEN
    NEW.vehicle_type := 'PETROL'::vehicle_type_enum;
  ELSIF v_name ILIKE '%bike%' THEN
    NEW.vehicle_type := 'BIKE'::vehicle_type_enum;
  ELSE
    NEW.vehicle_type := 'ELECTRIC'::vehicle_type_enum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_booking_vehicle_type ON bookings;
CREATE TRIGGER trigger_set_booking_vehicle_type
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_vehicle_type_from_vehicle();

-- Remove stale per-vehicle capacity rows for inactive vehicles on future slots
CREATE OR REPLACE FUNCTION prune_inactive_slot_vehicle_capacities(p_slot_ids UUID[] DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM slot_vehicle_capacity svc
  USING vehicles v, slots s
  WHERE svc.vehicle_id = v.id
    AND svc.slot_id = s.id
    AND v.is_active = false
    AND COALESCE(s.slot_date, (s.start_time AT TIME ZONE 'Asia/Kolkata')::date)
        >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    AND (p_slot_ids IS NULL OR svc.slot_id = ANY(p_slot_ids));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prune_inactive_slot_vehicle_capacities IS
  'Deletes slot_vehicle_capacity rows for inactive vehicles on today+ slots';
