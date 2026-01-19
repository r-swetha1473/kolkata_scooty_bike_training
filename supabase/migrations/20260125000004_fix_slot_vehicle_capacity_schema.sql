-- Migration: Fix slot_vehicle_capacity table and ensure proper schema
-- Date: 2026-01-25
-- Description: Ensures slot_vehicle_capacity table exists with proper schema and relationships
--              Creates missing functions and indexes

-- Step 1: Create slot_vehicle_capacity table if it doesn't exist
CREATE TABLE IF NOT EXISTS slot_vehicle_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, vehicle_id)
);

-- Step 2: Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_id ON slot_vehicle_capacity(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_vehicle_id ON slot_vehicle_capacity(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_vehicle ON slot_vehicle_capacity(slot_id, vehicle_id);

-- Step 3: Add trigger for updated_at timestamp (if function exists)
DO $$
BEGIN
  -- Check if update_updated_at_column function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS update_slot_vehicle_capacity_updated_at ON slot_vehicle_capacity;
    
    -- Create trigger
    CREATE TRIGGER update_slot_vehicle_capacity_updated_at
      BEFORE UPDATE ON slot_vehicle_capacity
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  ELSE
    -- Create custom function if update_updated_at_column doesn't exist
    CREATE OR REPLACE FUNCTION update_slot_vehicle_capacity_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Create trigger
    DROP TRIGGER IF EXISTS update_slot_vehicle_capacity_updated_at ON slot_vehicle_capacity;
    CREATE TRIGGER update_slot_vehicle_capacity_updated_at
      BEFORE UPDATE ON slot_vehicle_capacity
      FOR EACH ROW
      EXECUTE FUNCTION update_slot_vehicle_capacity_updated_at();
  END IF;
END $$;

-- Step 4: Create function to ensure slot has capacity entries for all active vehicles
CREATE OR REPLACE FUNCTION ensure_slot_vehicle_capacities(p_slot_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
  SELECT p_slot_id, v.id, v.max_per_slot
  FROM vehicles v
  WHERE v.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM slot_vehicle_capacity svc
      WHERE svc.slot_id = p_slot_id AND svc.vehicle_id = v.id
    )
  ON CONFLICT (slot_id, vehicle_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to get vehicle capacity for a slot
CREATE OR REPLACE FUNCTION get_slot_vehicle_capacity(p_slot_id UUID, p_vehicle_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_capacity INTEGER;
BEGIN
  SELECT capacity INTO v_capacity
  FROM slot_vehicle_capacity
  WHERE slot_id = p_slot_id AND vehicle_id = p_vehicle_id;
  
  RETURN COALESCE(v_capacity, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Migrate existing slots without capacity entries
-- Ensure all existing slots have capacity entries for all active vehicles
DO $$
DECLARE
  slot_record RECORD;
BEGIN
  FOR slot_record IN 
    SELECT DISTINCT s.id
    FROM slots s
    WHERE NOT EXISTS (
      SELECT 1 FROM slot_vehicle_capacity svc WHERE svc.slot_id = s.id
    )
  LOOP
    PERFORM ensure_slot_vehicle_capacities(slot_record.id);
  END LOOP;
END $$;

-- Step 7: Add comments
COMMENT ON TABLE slot_vehicle_capacity IS 'Junction table storing capacity per vehicle per slot. Replaces hardcoded electric_capacity, petrol_capacity, bike_capacity columns.';
COMMENT ON COLUMN slot_vehicle_capacity.capacity IS 'Maximum number of this vehicle type that can be booked for this slot';
COMMENT ON COLUMN slot_vehicle_capacity.slot_id IS 'Reference to slots table';
COMMENT ON COLUMN slot_vehicle_capacity.vehicle_id IS 'Reference to vehicles table';
COMMENT ON FUNCTION ensure_slot_vehicle_capacities IS 'Ensures a slot has capacity entries for all active vehicles';
COMMENT ON FUNCTION get_slot_vehicle_capacity IS 'Gets the capacity for a specific vehicle in a slot';
