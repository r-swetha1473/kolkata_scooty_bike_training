-- Migration: Refactor Vehicles Table for Dynamic Vehicle Management
-- Date: 2026-01-23
-- Description: Refactors vehicles table to have id, name, max_per_slot, is_active
--              Removes hardcoded vehicle types and enables dynamic vehicle management

-- Step 1: Add max_per_slot column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'max_per_slot'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN max_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_per_slot > 0);
  END IF;
END $$;

-- Step 2: Migrate existing vehicles data to set max_per_slot based on vehicle_subtype
UPDATE vehicles
SET max_per_slot = CASE 
  WHEN vehicle_subtype LIKE '%Electric%' THEN 3
  WHEN vehicle_subtype LIKE '%Petrol%' THEN 1
  WHEN vehicle_subtype = 'Bike' THEN 1
  ELSE 1 -- Default
END
WHERE max_per_slot IS NULL OR max_per_slot = 1;

-- Step 3: Ensure is_active column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Step 4: Remove old columns that are no longer needed (type, vehicle_subtype, description)
-- Keep them for now to avoid breaking existing code, but mark as deprecated
-- These will be removed in a future migration after full refactoring

-- Step 5: Ensure name is unique and not null
DO $$
BEGIN
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_name_key'
  ) THEN
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_name_key UNIQUE (name);
  END IF;
  
  -- Ensure name is not null
  ALTER TABLE vehicles ALTER COLUMN name SET NOT NULL;
END $$;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON vehicles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vehicles_name ON vehicles(name);

-- Step 6: Add comments
COMMENT ON TABLE vehicles IS 'Dynamic vehicle management table. Each vehicle has a max_per_slot capacity.';
COMMENT ON COLUMN vehicles.max_per_slot IS 'Maximum number of this vehicle type that can be booked per slot';
COMMENT ON COLUMN vehicles.is_active IS 'Whether this vehicle is currently available for booking';

-- Step 7: Update bookings table to reference vehicles by id
-- Ensure vehicle_id foreign key exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_vehicle_id_fkey'
  ) THEN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_vehicle_id_fkey 
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 8: Create function to get vehicle capacity for a slot
CREATE OR REPLACE FUNCTION get_vehicle_capacity_for_slot(
  p_slot_id UUID,
  p_vehicle_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_max_per_slot INTEGER;
BEGIN
  SELECT max_per_slot INTO v_max_per_slot
  FROM vehicles
  WHERE id = p_vehicle_id AND is_active = true;
  
  RETURN COALESCE(v_max_per_slot, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create function to get booked count for a vehicle in a slot
CREATE OR REPLACE FUNCTION get_vehicle_booked_count(
  p_slot_id UUID,
  p_vehicle_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bookings
  WHERE slot_id = p_slot_id
    AND vehicle_id = p_vehicle_id
    AND status NOT IN ('cancelled');
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;
