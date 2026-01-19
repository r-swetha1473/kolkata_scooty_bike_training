-- Migration: Kolkata Scooty Bike Training Centre - Final Requirements
-- Date: 2025-01-05
-- Description: Implements all final requirements including phone-based registration, weekly limits, vehicle types, etc.

-- 1. Make phone number unique and required for customers
DO $$ 
BEGIN
  -- Add unique constraint on phone (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_phone_key'
  ) THEN
    CREATE UNIQUE INDEX profiles_phone_key ON profiles(phone) WHERE phone IS NOT NULL;
  END IF;
  
  -- Add NOT NULL constraint on phone for customers (if not exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='profiles' AND column_name='phone' AND is_nullable='YES'
  ) THEN
    -- First, set default phone for existing records without phone (all roles)
    UPDATE profiles SET phone = 'UNKNOWN_' || id::text WHERE phone IS NULL;
    -- Also fix any GOOGLE_ prefixed phones that might be missing
    UPDATE profiles SET phone = 'GOOGLE_' || COALESCE(google_id, provider_id, id::text) 
    WHERE phone IS NULL AND (google_id IS NOT NULL OR provider_id IS NOT NULL);
    -- Fix trainer phones
    UPDATE profiles SET phone = 'TRAINER_' || id::text 
    WHERE phone IS NULL AND role = 'trainer';
    -- Fix admin/superadmin phones
    UPDATE profiles SET phone = 'ADMIN_' || id::text 
    WHERE phone IS NULL AND role IN ('admin', 'superadmin');
    -- Final fallback for any remaining NULL phones
    UPDATE profiles SET phone = 'USER_' || id::text WHERE phone IS NULL;
    -- Then add NOT NULL constraint
    ALTER TABLE profiles ALTER COLUMN phone SET NOT NULL;
  END IF;
END $$;

-- 2. Add weekly booking tracking fields to profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='total_bookings') THEN
    ALTER TABLE profiles ADD COLUMN total_bookings INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='last_booking_date') THEN
    ALTER TABLE profiles ADD COLUMN last_booking_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='weekly_booking_count') THEN
    ALTER TABLE profiles ADD COLUMN weekly_booking_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='weekly_reset_date') THEN
    ALTER TABLE profiles ADD COLUMN weekly_reset_date DATE;
  END IF;
END $$;

-- 3. Update vehicles table to support vehicle subtypes
DO $$ 
BEGIN
  -- Add vehicle_subtype column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='vehicles' AND column_name='vehicle_subtype') THEN
    ALTER TABLE vehicles ADD COLUMN vehicle_subtype TEXT 
      CHECK (vehicle_subtype IN ('Electric Scooty', 'Petrol Scooty', 'Bike'));
  END IF;
  
  -- Update type constraint to include both Scooty and Bike
  ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_type_check;
  ALTER TABLE vehicles ADD CONSTRAINT vehicles_type_check 
    CHECK (type IN ('Scooty', 'Bike'));
END $$;

-- 4. Insert/Update vehicles as per requirements
-- 3 Electric Scooties, 1 Petrol Scooty, 1 Bike
INSERT INTO vehicles (name, type, vehicle_subtype, description, is_active) 
VALUES 
  ('Electric Scooty 1', 'Scooty', 'Electric Scooty', 'Electric scooter for training', true),
  ('Electric Scooty 2', 'Scooty', 'Electric Scooty', 'Electric scooter for training', true),
  ('Electric Scooty 3', 'Scooty', 'Electric Scooty', 'Electric scooter for training', true),
  ('Petrol Scooty', 'Scooty', 'Petrol Scooty', 'Petrol scooter for training', true),
  ('Bike', 'Bike', 'Bike', 'Motorcycle for training', true)
ON CONFLICT (name) DO UPDATE SET
  vehicle_subtype = EXCLUDED.vehicle_subtype,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 5. Add vehicle capacity breakdown columns to slots
DO $$ 
BEGIN
  -- Add vehicle capacity columns if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='electric_capacity') THEN
    ALTER TABLE slots ADD COLUMN electric_capacity INTEGER NOT NULL DEFAULT 3;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='petrol_capacity') THEN
    ALTER TABLE slots ADD COLUMN petrol_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='bike_capacity') THEN
    ALTER TABLE slots ADD COLUMN bike_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Update existing slots with vehicle capacity breakdown
  UPDATE slots 
  SET electric_capacity = 3, petrol_capacity = 1, bike_capacity = 1
  WHERE electric_capacity IS NULL OR petrol_capacity IS NULL OR bike_capacity IS NULL;
END $$;

-- 5a. Update slots to enforce max capacity of 5 and prevent overbooking
DO $$ 
BEGIN
  -- Remove default capacity value (no defaults allowed)
  ALTER TABLE slots ALTER COLUMN capacity DROP DEFAULT;
  
  -- Update capacity constraint if needed
  ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_capacity_check;
  ALTER TABLE slots ADD CONSTRAINT slots_capacity_check 
    CHECK (capacity = 5); -- Strict: capacity must always be 5
  
  -- Ensure booked_count never exceeds capacity (strict enforcement)
  ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_booked_count_check;
  ALTER TABLE slots ADD CONSTRAINT slots_booked_count_check 
    CHECK (booked_count >= 0 AND booked_count <= capacity);
  
  -- Ensure vehicle capacities sum to 5
  ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_vehicle_capacity_check;
  ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
    CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);
  
  -- Update existing slots with capacity != 5 to 5
  UPDATE slots SET capacity = 5, electric_capacity = 3, petrol_capacity = 1, bike_capacity = 1 
  WHERE capacity != 5 OR electric_capacity + petrol_capacity + bike_capacity != 5;
  
  -- Fix any overbooked slots (shouldn't happen, but safety check)
  UPDATE slots SET booked_count = capacity WHERE booked_count > capacity;
END $$;

-- 6. Add slot visibility tracking (24-hour rule)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='slots' AND column_name='is_visible') THEN
    ALTER TABLE slots ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 7. Add cancellation window tracking to bookings
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='can_cancel') THEN
    ALTER TABLE bookings ADD COLUMN can_cancel BOOLEAN NOT NULL DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='cancellation_deadline') THEN
    ALTER TABLE bookings ADD COLUMN cancellation_deadline TIMESTAMPTZ;
  END IF;
END $$;

-- 8. Create function to check weekly booking limit
CREATE OR REPLACE FUNCTION check_weekly_booking_limit(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_week_start DATE;
  weekly_count INTEGER;
  reset_date DATE;
BEGIN
  -- Get current week start (Monday)
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  
  -- Get user's weekly reset date
  SELECT weekly_reset_date INTO reset_date FROM profiles WHERE id = user_id_param;
  
  -- If reset_date is NULL or before current week start, reset the count
  IF reset_date IS NULL OR reset_date < current_week_start THEN
    UPDATE profiles 
    SET weekly_booking_count = 0, weekly_reset_date = current_week_start 
    WHERE id = user_id_param;
    weekly_count := 0;
  ELSE
    SELECT weekly_booking_count INTO weekly_count FROM profiles WHERE id = user_id_param;
  END IF;
  
  -- Check if user has reached the limit (max 2 per week)
  RETURN weekly_count < 2;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to increment weekly booking count
CREATE OR REPLACE FUNCTION increment_weekly_booking_count(user_id_param UUID)
RETURNS VOID AS $$
DECLARE
  current_week_start DATE;
  reset_date DATE;
BEGIN
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  
  SELECT weekly_reset_date INTO reset_date FROM profiles WHERE id = user_id_param;
  
  -- Reset if needed
  IF reset_date IS NULL OR reset_date < current_week_start THEN
    UPDATE profiles 
    SET weekly_booking_count = 1, 
        weekly_reset_date = current_week_start,
        total_bookings = total_bookings + 1,
        last_booking_date = CURRENT_DATE
    WHERE id = user_id_param;
  ELSE
    UPDATE profiles 
    SET weekly_booking_count = weekly_booking_count + 1,
        total_bookings = total_bookings + 1,
        last_booking_date = CURRENT_DATE
    WHERE id = user_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to check if slot is visible (24-hour rule)
CREATE OR REPLACE FUNCTION is_slot_visible(slot_start_time TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  -- Slot is visible if start_time is at least 24 hours from now
  RETURN slot_start_time >= (NOW() + INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- 10a. Create function to update visibility for all slots (can be called periodically)
CREATE OR REPLACE FUNCTION update_all_slots_visibility()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE slots
  SET is_visible = is_slot_visible(start_time)
  WHERE is_visible != is_slot_visible(start_time);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to check cancellation window (5 hours before)
CREATE OR REPLACE FUNCTION can_cancel_booking(booking_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  slot_start_time TIMESTAMPTZ;
  hours_until_slot NUMERIC;
BEGIN
  SELECT s.start_time INTO slot_start_time
  FROM bookings b
  JOIN slots s ON b.slot_id = s.id
  WHERE b.id = booking_id_param;
  
  IF slot_start_time IS NULL THEN
    RETURN false;
  END IF;
  
  hours_until_slot := EXTRACT(EPOCH FROM (slot_start_time - NOW())) / 3600;
  
  -- Can cancel if more than 5 hours before slot
  RETURN hours_until_slot > 5;
END;
$$ LANGUAGE plpgsql;

-- 12. Create index for weekly booking queries
CREATE INDEX IF NOT EXISTS idx_profiles_weekly_reset ON profiles(weekly_reset_date, weekly_booking_count);
CREATE INDEX IF NOT EXISTS idx_bookings_cancellation_deadline ON bookings(cancellation_deadline);

-- 13. Update slot generation function to use new timing schedule
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date DATE)
RETURNS INTEGER AS $$
DECLARE
  slot_count INTEGER := 0;
  slot_start_time TIMESTAMPTZ;
  slot_end_time TIMESTAMPTZ;
  current_slot_time TIMESTAMPTZ;
  day_of_week INTEGER;
  slot_exists BOOLEAN;
BEGIN
  day_of_week := EXTRACT(DOW FROM target_date); -- 0=Sunday, 1=Monday, ..., 6=Saturday
  
  -- Monday-Saturday: 7 AM - 9 PM (last slot 8:30-9:00 PM)
  IF day_of_week >= 1 AND day_of_week <= 6 THEN
    current_slot_time := target_date + INTERVAL '7 hours'; -- Start at 7 AM
    slot_end_time := target_date + INTERVAL '21 hours'; -- End at 9 PM (8:30 PM is last slot start)
    
    WHILE current_slot_time < slot_end_time LOOP
      slot_start_time := current_slot_time;
      current_slot_time := current_slot_time + INTERVAL '30 minutes';
      
      -- Check if slot already exists
      SELECT EXISTS (
        SELECT 1 FROM slots 
        WHERE slot_date = target_date 
          AND start_time = slot_start_time 
          AND trainer_id IS NULL
          AND is_auto_generated = true
      ) INTO slot_exists;
      
      IF NOT slot_exists THEN
        INSERT INTO slots (
          trainer_id, start_time, end_time, slot_date,
          capacity, booked_count, status, is_auto_generated, is_visible,
          electric_capacity, petrol_capacity, bike_capacity
        ) VALUES (
          NULL, slot_start_time, current_slot_time, target_date,
          5, 0, 'available', true, 
          is_slot_visible(slot_start_time),
          3, 1, 1
        );
        slot_count := slot_count + 1;
      END IF;
    END LOOP;
  
  -- Sunday: Exact times only (10:30 AM-12:30 PM and 3:00 PM-8:00 PM)
  ELSIF day_of_week = 0 THEN
    -- Morning slots: 10:30, 11:00, 11:30, 12:00, 12:30
    -- Generate 10:30 AM slot
    slot_start_time := target_date + INTERVAL '10 hours 30 minutes';
    SELECT EXISTS (
      SELECT 1 FROM slots 
      WHERE slot_date = target_date 
        AND start_time = slot_start_time 
        AND trainer_id IS NULL
        AND is_auto_generated = true
    ) INTO slot_exists;
    IF NOT slot_exists THEN
      INSERT INTO slots (
        trainer_id, start_time, end_time, slot_date,
        capacity, booked_count, status, is_auto_generated, is_visible,
        electric_capacity, petrol_capacity, bike_capacity
      ) VALUES (
        NULL, slot_start_time, slot_start_time + INTERVAL '30 minutes', target_date,
        5, 0, 'available', true, is_slot_visible(slot_start_time),
        3, 1, 1
      );
      slot_count := slot_count + 1;
    END IF;
    
    -- Generate 11:00 AM slot
    slot_start_time := target_date + INTERVAL '11 hours';
    SELECT EXISTS (
      SELECT 1 FROM slots 
      WHERE slot_date = target_date 
        AND start_time = slot_start_time 
        AND trainer_id IS NULL
        AND is_auto_generated = true
    ) INTO slot_exists;
    IF NOT slot_exists THEN
      INSERT INTO slots (
        trainer_id, start_time, end_time, slot_date,
        capacity, booked_count, status, is_auto_generated, is_visible,
        electric_capacity, petrol_capacity, bike_capacity
      ) VALUES (
        NULL, slot_start_time, slot_start_time + INTERVAL '30 minutes', target_date,
        5, 0, 'available', true, is_slot_visible(slot_start_time),
        3, 1, 1
      );
      slot_count := slot_count + 1;
    END IF;
    
    -- Generate 11:30 AM slot
    slot_start_time := target_date + INTERVAL '11 hours 30 minutes';
    SELECT EXISTS (
      SELECT 1 FROM slots 
      WHERE slot_date = target_date 
        AND start_time = slot_start_time 
        AND trainer_id IS NULL
        AND is_auto_generated = true
    ) INTO slot_exists;
    IF NOT slot_exists THEN
      INSERT INTO slots (
        trainer_id, start_time, end_time, slot_date,
        capacity, booked_count, status, is_auto_generated, is_visible,
        electric_capacity, petrol_capacity, bike_capacity
      ) VALUES (
        NULL, slot_start_time, slot_start_time + INTERVAL '30 minutes', target_date,
        5, 0, 'available', true, is_slot_visible(slot_start_time),
        3, 1, 1
      );
      slot_count := slot_count + 1;
    END IF;
    
    -- Generate 12:00 PM slot
    slot_start_time := target_date + INTERVAL '12 hours';
    SELECT EXISTS (
      SELECT 1 FROM slots 
      WHERE slot_date = target_date 
        AND start_time = slot_start_time 
        AND trainer_id IS NULL
        AND is_auto_generated = true
    ) INTO slot_exists;
    IF NOT slot_exists THEN
      INSERT INTO slots (
        trainer_id, start_time, end_time, slot_date,
        capacity, booked_count, status, is_auto_generated, is_visible,
        electric_capacity, petrol_capacity, bike_capacity
      ) VALUES (
        NULL, slot_start_time, slot_start_time + INTERVAL '30 minutes', target_date,
        5, 0, 'available', true, is_slot_visible(slot_start_time),
        3, 1, 1
      );
      slot_count := slot_count + 1;
    END IF;
    
    -- Generate 12:30 PM slot
    slot_start_time := target_date + INTERVAL '12 hours 30 minutes';
    SELECT EXISTS (
      SELECT 1 FROM slots 
      WHERE slot_date = target_date 
        AND start_time = slot_start_time 
        AND trainer_id IS NULL
        AND is_auto_generated = true
    ) INTO slot_exists;
    IF NOT slot_exists THEN
      INSERT INTO slots (
        trainer_id, start_time, end_time, slot_date,
        capacity, booked_count, status, is_auto_generated, is_visible,
        electric_capacity, petrol_capacity, bike_capacity
      ) VALUES (
        NULL, slot_start_time, slot_start_time + INTERVAL '30 minutes', target_date,
        5, 0, 'available', true, is_slot_visible(slot_start_time),
        3, 1, 1
      );
      slot_count := slot_count + 1;
    END IF;
    
    -- Evening slots: 3:00 PM to 8:00 PM (every 30 minutes)
    current_slot_time := target_date + INTERVAL '15 hours'; -- 3:00 PM
    slot_end_time := target_date + INTERVAL '20 hours'; -- 8:00 PM
    
    WHILE current_slot_time <= slot_end_time LOOP
      slot_start_time := current_slot_time;
      current_slot_time := current_slot_time + INTERVAL '30 minutes';
      
      SELECT EXISTS (
        SELECT 1 FROM slots 
        WHERE slot_date = target_date 
          AND start_time = slot_start_time 
          AND trainer_id IS NULL
          AND is_auto_generated = true
      ) INTO slot_exists;
      
      IF NOT slot_exists THEN
        INSERT INTO slots (
          trainer_id, start_time, end_time, slot_date,
          capacity, booked_count, status, is_auto_generated, is_visible,
          electric_capacity, petrol_capacity, bike_capacity
        ) VALUES (
          NULL, slot_start_time, current_slot_time, target_date,
          5, 0, 'available', true,
          is_slot_visible(slot_start_time),
          3, 1, 1
        );
        slot_count := slot_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  RETURN slot_count;
END;
$$ LANGUAGE plpgsql;

-- 14. Create trigger to update slot visibility on insert/update
CREATE OR REPLACE FUNCTION update_slot_visibility()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_visible := is_slot_visible(NEW.start_time);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_slot_visibility
  BEFORE INSERT OR UPDATE OF start_time ON slots
  FOR EACH ROW
  EXECUTE FUNCTION update_slot_visibility();

-- 15. Create trigger to set cancellation deadline on booking
CREATE OR REPLACE FUNCTION set_booking_cancellation_deadline()
RETURNS TRIGGER AS $$
DECLARE
  slot_start_time TIMESTAMPTZ;
BEGIN
  SELECT start_time INTO slot_start_time FROM slots WHERE id = NEW.slot_id;
  IF slot_start_time IS NOT NULL THEN
    NEW.cancellation_deadline := slot_start_time - INTERVAL '5 hours';
    NEW.can_cancel := (slot_start_time - INTERVAL '5 hours') > NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_booking_cancellation_deadline
  BEFORE INSERT OR UPDATE OF slot_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_cancellation_deadline();

-- 16. Add comments
COMMENT ON COLUMN profiles.phone IS 'Unique phone number - acts as account identifier for customers';
COMMENT ON COLUMN profiles.weekly_booking_count IS 'Number of bookings made in current week (resets weekly)';
COMMENT ON COLUMN profiles.total_bookings IS 'Total number of bookings made by customer';
COMMENT ON COLUMN slots.capacity IS 'Maximum capacity per slot (max 5 trainees)';
COMMENT ON COLUMN slots.is_visible IS 'Whether slot is visible to customers (24-hour rule)';
COMMENT ON COLUMN bookings.can_cancel IS 'Whether booking can be cancelled (5-hour rule)';
COMMENT ON COLUMN bookings.cancellation_deadline IS 'Deadline for cancellation (5 hours before slot)';

