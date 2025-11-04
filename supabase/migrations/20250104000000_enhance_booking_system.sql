-- Migration: Enhance Booking System for Production
-- Date: 2025-01-04
-- Description: Adds vehicles, provider tracking, disabled slot status, and booking enhancements

-- Add provider_id and auth_provider to profiles (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='provider_id') THEN
    ALTER TABLE profiles ADD COLUMN provider_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='auth_provider') THEN
    ALTER TABLE profiles ADD COLUMN auth_provider TEXT DEFAULT 'google' 
      CHECK (auth_provider IN ('google', 'email', 'phone'));
    CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider ON profiles(auth_provider);
  END IF;
END $$;

-- Update google_id to provider_id for existing records (migration helper)
UPDATE profiles 
SET provider_id = google_id, auth_provider = 'google' 
WHERE google_id IS NOT NULL AND provider_id IS NULL;

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('Scooty', 'Bike')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default vehicles
INSERT INTO vehicles (name, type, description) 
VALUES 
  ('Scooty', 'Scooty', 'Two-wheeler scooter for training'),
  ('Bike', 'Bike', 'Motorcycle for training')
ON CONFLICT (name) DO NOTHING;

-- Add vehicle_id to bookings table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='bookings' AND column_name='vehicle_id') THEN
    ALTER TABLE bookings ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_id ON bookings(vehicle_id);
  END IF;
END $$;

-- Update slots status to include 'disabled'
ALTER TABLE slots 
DROP CONSTRAINT IF EXISTS slots_status_check;

ALTER TABLE slots 
ADD CONSTRAINT slots_status_check 
CHECK (status IN ('available', 'full', 'cancelled', 'completed', 'disabled'));

-- Add unique constraint for slot_date + start_time + trainer_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_slot 
ON slots (slot_date, start_time, trainer_id) 
WHERE trainer_id IS NOT NULL;

-- Add unique constraint for slot_date + start_time for unassigned slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_unassigned 
ON slots (slot_date, start_time) 
WHERE trainer_id IS NULL;

-- Add trigger to update vehicles updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to ensure daily slots exist (called by cron or on-demand)
CREATE OR REPLACE FUNCTION ensure_daily_slots(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  slot_count INTEGER;
  slot_start_time TIMESTAMPTZ;
  slot_end_time TIMESTAMPTZ;
  current_slot_time TIMESTAMPTZ;
  slot_exists BOOLEAN;
BEGIN
  slot_count := 0;
  current_slot_time := target_date + INTERVAL '9 hours'; -- Start at 9 AM
  slot_end_time := target_date + INTERVAL '21 hours'; -- End at 9 PM
  
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
        trainer_id, 
        start_time, 
        end_time, 
        slot_date,
        capacity, 
        booked_count, 
        status, 
        is_auto_generated
      ) VALUES (
        NULL, 
        slot_start_time, 
        current_slot_time, 
        target_date,
        1, 
        0, 
        'available', 
        true
      );
      
      slot_count := slot_count + 1;
    END IF;
  END LOOP;
  
  RETURN slot_count;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster slot date queries
CREATE INDEX IF NOT EXISTS idx_slots_date_status ON slots(slot_date, status) WHERE status IN ('available', 'disabled');

COMMENT ON TABLE vehicles IS 'Available vehicles for training (Scooty or Bike)';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID (e.g., Google ID)';
COMMENT ON COLUMN profiles.auth_provider IS 'Authentication provider used (google, email, phone)';
COMMENT ON COLUMN bookings.vehicle_id IS 'Vehicle selected for this booking';

