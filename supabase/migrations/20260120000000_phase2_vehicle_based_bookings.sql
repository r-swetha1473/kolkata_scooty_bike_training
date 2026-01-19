-- Migration: PHASE 2 - Vehicle-Based Booking System
-- Date: 2026-01-20
-- Description: Adds vehicle_type and phone columns to bookings table for vehicle-based capacity management
--              Adds database constraints to prevent overbooking at DB level

-- Step 1: Create vehicle_type enum type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type_enum') THEN
    CREATE TYPE vehicle_type_enum AS ENUM ('ELECTRIC', 'PETROL', 'BIKE');
  END IF;
END $$;

-- Step 2: Add vehicle_type column to bookings table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'vehicle_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN vehicle_type vehicle_type_enum;
    
    COMMENT ON COLUMN bookings.vehicle_type IS 'Vehicle type for this booking: ELECTRIC, PETROL, or BIKE';
  END IF;
END $$;

-- Step 3: Add phone column to bookings table for direct phone-based validation
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'phone'
  ) THEN
    ALTER TABLE bookings ADD COLUMN phone TEXT;
    
    COMMENT ON COLUMN bookings.phone IS 'Phone number of the user who made the booking (for phone-based validation)';
  END IF;
END $$;

-- Step 4: Migrate existing data - Populate vehicle_type from vehicles table
UPDATE bookings b
SET vehicle_type = CASE
  WHEN v.vehicle_subtype IS NOT NULL THEN
    CASE
      WHEN v.vehicle_subtype LIKE '%Electric%' THEN 'ELECTRIC'::vehicle_type_enum
      WHEN v.vehicle_subtype LIKE '%Petrol%' THEN 'PETROL'::vehicle_type_enum
      WHEN v.vehicle_subtype = 'Bike' THEN 'BIKE'::vehicle_type_enum
      ELSE 'ELECTRIC'::vehicle_type_enum -- Default fallback
    END
  WHEN v.type = 'Scooty' THEN 'ELECTRIC'::vehicle_type_enum -- Default Scooty to Electric
  WHEN v.type = 'Bike' THEN 'BIKE'::vehicle_type_enum
  ELSE 'ELECTRIC'::vehicle_type_enum -- Default fallback
END
FROM vehicles v
WHERE b.vehicle_id = v.id
  AND b.vehicle_type IS NULL;

-- Step 5: Migrate existing data - Populate phone from profiles table
UPDATE bookings b
SET phone = p.phone
FROM profiles p
WHERE b.user_id = p.id
  AND b.phone IS NULL
  AND p.phone IS NOT NULL;

-- Step 6: Make vehicle_type NOT NULL after migration (with default for any remaining NULLs)
DO $$ 
BEGIN
  -- Set default for any remaining NULL vehicle_type
  UPDATE bookings 
  SET vehicle_type = 'ELECTRIC'::vehicle_type_enum
  WHERE vehicle_type IS NULL;
  
  -- Make vehicle_type NOT NULL
  ALTER TABLE bookings ALTER COLUMN vehicle_type SET NOT NULL;
END $$;

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_type ON bookings(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone) WHERE phone IS NOT NULL;

-- Create index for weekly booking checks (phone + created_at week)
-- Note: Using created_at instead of slot_date since bookings table doesn't have slot_date
CREATE INDEX IF NOT EXISTS idx_bookings_phone_created_week ON bookings(phone, created_at) 
  WHERE phone IS NOT NULL AND status NOT IN ('cancelled');

CREATE INDEX IF NOT EXISTS idx_bookings_slot_vehicle_type ON bookings(slot_id, vehicle_type, status) 
  WHERE status NOT IN ('cancelled');

-- Step 8: Create function to check vehicle capacity before booking
CREATE OR REPLACE FUNCTION check_vehicle_capacity(
  p_slot_id UUID,
  p_vehicle_type vehicle_type_enum
)
RETURNS BOOLEAN AS $$
DECLARE
  v_electric_capacity INTEGER;
  v_petrol_capacity INTEGER;
  v_bike_capacity INTEGER;
  v_electric_booked INTEGER;
  v_petrol_booked INTEGER;
  v_bike_booked INTEGER;
BEGIN
  -- Get slot capacities
  SELECT electric_capacity, petrol_capacity, bike_capacity
  INTO v_electric_capacity, v_petrol_capacity, v_bike_capacity
  FROM slots
  WHERE id = p_slot_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get current bookings by vehicle type
  SELECT 
    COUNT(*) FILTER (WHERE vehicle_type = 'ELECTRIC'),
    COUNT(*) FILTER (WHERE vehicle_type = 'PETROL'),
    COUNT(*) FILTER (WHERE vehicle_type = 'BIKE')
  INTO v_electric_booked, v_petrol_booked, v_bike_booked
  FROM bookings
  WHERE slot_id = p_slot_id
    AND status NOT IN ('cancelled');
  
  -- Check capacity for requested vehicle type
  CASE p_vehicle_type
    WHEN 'ELECTRIC' THEN
      RETURN v_electric_booked < v_electric_capacity;
    WHEN 'PETROL' THEN
      RETURN v_petrol_booked < v_petrol_capacity;
    WHEN 'BIKE' THEN
      RETURN v_bike_booked < v_bike_capacity;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create trigger function to validate vehicle capacity on insert
CREATE OR REPLACE FUNCTION validate_booking_vehicle_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_capacity_available BOOLEAN;
BEGIN
  -- Check if capacity is available for this vehicle type
  SELECT check_vehicle_capacity(NEW.slot_id, NEW.vehicle_type)
  INTO v_capacity_available;
  
  IF NOT v_capacity_available THEN
    RAISE EXCEPTION 'Vehicle capacity exceeded for vehicle type % in slot %', NEW.vehicle_type, NEW.slot_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger to enforce vehicle capacity on insert
DROP TRIGGER IF EXISTS trigger_validate_booking_vehicle_capacity ON bookings;
CREATE TRIGGER trigger_validate_booking_vehicle_capacity
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_vehicle_capacity();

-- Step 11: Add constraint to ensure phone format (if provided)
-- Note: We allow NULL for backward compatibility, but new bookings should have phone
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_phone_format_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_phone_format_check 
  CHECK (phone IS NULL OR (LENGTH(phone) = 10 AND phone ~ '^[0-9]+$'));

-- Step 12: Add comment for documentation
COMMENT ON FUNCTION check_vehicle_capacity IS 'Checks if capacity is available for a specific vehicle type in a slot';
COMMENT ON FUNCTION validate_booking_vehicle_capacity IS 'Trigger function to validate vehicle capacity before booking insert';
