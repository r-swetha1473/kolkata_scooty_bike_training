-- Add vehicle capacity columns to slots table if they don't exist
-- This migration ensures electric_capacity, petrol_capacity, and bike_capacity columns exist

DO $$ 
BEGIN
  -- Add electric_capacity column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'slots' 
      AND column_name = 'electric_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN electric_capacity INTEGER NOT NULL DEFAULT 3;
  END IF;
  
  -- Add petrol_capacity column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'slots' 
      AND column_name = 'petrol_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN petrol_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Add bike_capacity column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'slots' 
      AND column_name = 'bike_capacity'
  ) THEN
    ALTER TABLE slots ADD COLUMN bike_capacity INTEGER NOT NULL DEFAULT 1;
  END IF;
  
  -- Update existing slots with vehicle capacity breakdown if they are NULL
  UPDATE slots 
  SET electric_capacity = 3, 
      petrol_capacity = 1, 
      bike_capacity = 1
  WHERE electric_capacity IS NULL 
     OR petrol_capacity IS NULL 
     OR bike_capacity IS NULL;
  
  -- Add constraint to ensure vehicle capacities sum to 5 (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'slots_vehicle_capacity_check'
  ) THEN
    ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
      CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);
  END IF;
END $$;
