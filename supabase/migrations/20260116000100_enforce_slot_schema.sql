-- Migration: Enforce Slot Schema
-- Date: 2026-01-16
-- Description: Ensures all columns referenced in slots.js exist in the slots table
-- This migration enforces the complete slot schema including visibility, vehicle capacity, and status fields

-- 1. Add is_visible column (visibility field for 24-hour rule)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'is_visible'
  ) THEN
    ALTER TABLE slots ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT true;
    
    -- Update existing slots based on 24-hour rule
    UPDATE slots 
    SET is_visible = (start_time >= (NOW() + INTERVAL '24 hours'))
    WHERE is_visible IS NULL;
    
    COMMENT ON COLUMN slots.is_visible IS 'Whether slot is visible to customers (24-hour rule)';
  END IF;
END $$;

-- 2. Add vehicle capacity columns (electric_capacity, petrol_capacity, bike_capacity)
DO $$ 
BEGIN
  -- Add electric_capacity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'electric_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN electric_capacity INTEGER NOT NULL DEFAULT 3;
  END IF;
  
  -- Add petrol_capacity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'petrol_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN petrol_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Add bike_capacity column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'bike_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN bike_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Update existing slots with default vehicle capacity breakdown if any are NULL
  UPDATE slots 
  SET electric_capacity = COALESCE(electric_capacity, 3),
      petrol_capacity = COALESCE(petrol_capacity, 1),
      bike_capacity = COALESCE(bike_capacity, 1)
  WHERE electric_capacity IS NULL OR petrol_capacity IS NULL OR bike_capacity IS NULL;
  
  -- Add constraint to ensure vehicle capacities sum to 5 (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'slots_vehicle_capacity_check'
  ) THEN
    ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
      CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);
  END IF;
END $$;

-- 3. Ensure slot_date column exists (should already exist, but enforce it)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'slot_date'
  ) THEN
    ALTER TABLE slots ADD COLUMN slot_date DATE;
    
    -- Populate slot_date from start_time for existing records
    UPDATE slots 
    SET slot_date = start_time::date
    WHERE slot_date IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE slots ALTER COLUMN slot_date SET NOT NULL;
  END IF;
END $$;

-- 4. Ensure is_auto_generated column exists (should already exist, but enforce it)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'slots' AND column_name = 'is_auto_generated'
  ) THEN
    ALTER TABLE slots ADD COLUMN is_auto_generated BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 5. Update status constraint to include 'disabled' status
DO $$ 
BEGIN
  -- Drop existing constraint if it doesn't include 'disabled'
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'slots_status_check'
  ) THEN
    ALTER TABLE slots DROP CONSTRAINT slots_status_check;
  END IF;
  
  -- Add updated constraint with 'disabled' status
  ALTER TABLE slots ADD CONSTRAINT slots_status_check 
    CHECK (status IN ('available', 'full', 'cancelled', 'completed', 'disabled'));
END $$;

-- 6. Ensure capacity constraint enforces max of 5
DO $$ 
BEGIN
  -- Drop existing capacity constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'slots_capacity_check'
  ) THEN
    ALTER TABLE slots DROP CONSTRAINT slots_capacity_check;
  END IF;
  
  -- Add constraint to enforce capacity = 5
  ALTER TABLE slots ADD CONSTRAINT slots_capacity_check 
    CHECK (capacity = 5);
  
  -- Update any existing slots with capacity != 5
  UPDATE slots 
  SET capacity = 5,
      electric_capacity = 3,
      petrol_capacity = 1,
      bike_capacity = 1
  WHERE capacity != 5;
END $$;

-- 7. Ensure booked_count constraint exists
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'slots_booked_count_check'
  ) THEN
    ALTER TABLE slots DROP CONSTRAINT slots_booked_count_check;
  END IF;
  
  -- Add constraint to ensure booked_count doesn't exceed capacity
  ALTER TABLE slots ADD CONSTRAINT slots_booked_count_check 
    CHECK (booked_count >= 0 AND booked_count <= capacity);
  
  -- Fix any overbooked slots (safety check)
  UPDATE slots 
  SET booked_count = capacity 
  WHERE booked_count > capacity;
END $$;

-- 8. Add indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_slots_is_visible ON slots(is_visible) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_slots_vehicle_capacity ON slots(electric_capacity, petrol_capacity, bike_capacity);
CREATE INDEX IF NOT EXISTS idx_slots_date_visible ON slots(slot_date, is_visible) WHERE is_visible = true;

-- 9. Add comments for documentation
COMMENT ON COLUMN slots.is_visible IS 'Whether slot is visible to customers (24-hour rule: visible if start_time >= NOW() + 24 hours)';
COMMENT ON COLUMN slots.electric_capacity IS 'Number of electric scooty slots available (default: 3)';
COMMENT ON COLUMN slots.petrol_capacity IS 'Number of petrol scooty slots available (default: 1)';
COMMENT ON COLUMN slots.bike_capacity IS 'Number of bike slots available (default: 1)';
COMMENT ON COLUMN slots.slot_date IS 'Date of the slot (derived from start_time)';
COMMENT ON COLUMN slots.is_auto_generated IS 'Whether slot was auto-generated by the system';
COMMENT ON COLUMN slots.status IS 'Slot status: available, full, cancelled, completed, or disabled';
