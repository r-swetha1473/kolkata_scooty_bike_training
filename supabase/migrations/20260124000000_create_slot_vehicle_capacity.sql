-- Migration: Create slot_vehicle_capacity table for dynamic vehicle capacity management
-- Date: 2026-01-24
-- Description: Refactors slot capacity from hardcoded columns to dynamic vehicle-based capacity table
--              Maintains backward compatibility with existing bookings

-- Step 1: Create slot_vehicle_capacity junction table
CREATE TABLE IF NOT EXISTS slot_vehicle_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, vehicle_id)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_id ON slot_vehicle_capacity(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_vehicle_id ON slot_vehicle_capacity(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_vehicle ON slot_vehicle_capacity(slot_id, vehicle_id);

-- Step 3: Migrate existing capacity data from slots table to slot_vehicle_capacity
-- Map electric_capacity, petrol_capacity, bike_capacity to vehicle_ids
DO $$
DECLARE
  slot_record RECORD;
  electric_vehicle_id UUID;
  petrol_vehicle_id UUID;
  bike_vehicle_id UUID;
BEGIN
  -- Find vehicle IDs by name (assuming standard names exist)
  SELECT id INTO electric_vehicle_id FROM vehicles WHERE name ILIKE '%electric%' AND is_active = true LIMIT 1;
  SELECT id INTO petrol_vehicle_id FROM vehicles WHERE name ILIKE '%petrol%' AND is_active = true LIMIT 1;
  SELECT id INTO bike_vehicle_id FROM vehicles WHERE name ILIKE '%bike%' AND is_active = true LIMIT 1;
  
  -- If vehicles don't exist by name, try to find by vehicle_subtype (backward compatibility)
  IF electric_vehicle_id IS NULL THEN
    SELECT id INTO electric_vehicle_id FROM vehicles WHERE vehicle_subtype ILIKE '%electric%' LIMIT 1;
  END IF;
  IF petrol_vehicle_id IS NULL THEN
    SELECT id INTO petrol_vehicle_id FROM vehicles WHERE vehicle_subtype ILIKE '%petrol%' LIMIT 1;
  END IF;
  IF bike_vehicle_id IS NULL THEN
    SELECT id INTO bike_vehicle_id FROM vehicles WHERE vehicle_subtype ILIKE '%bike%' OR type = 'Bike' LIMIT 1;
  END IF;
  
  -- Migrate data for each slot
  FOR slot_record IN 
    SELECT id, electric_capacity, petrol_capacity, bike_capacity 
    FROM slots 
    WHERE electric_capacity IS NOT NULL OR petrol_capacity IS NOT NULL OR bike_capacity IS NOT NULL
  LOOP
    -- Insert electric capacity if vehicle exists and capacity > 0
    IF electric_vehicle_id IS NOT NULL AND slot_record.electric_capacity IS NOT NULL AND slot_record.electric_capacity > 0 THEN
      INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
      VALUES (slot_record.id, electric_vehicle_id, slot_record.electric_capacity)
      ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity;
    END IF;
    
    -- Insert petrol capacity if vehicle exists and capacity > 0
    IF petrol_vehicle_id IS NOT NULL AND slot_record.petrol_capacity IS NOT NULL AND slot_record.petrol_capacity > 0 THEN
      INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
      VALUES (slot_record.id, petrol_vehicle_id, slot_record.petrol_capacity)
      ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity;
    END IF;
    
    -- Insert bike capacity if vehicle exists and capacity > 0
    IF bike_vehicle_id IS NOT NULL AND slot_record.bike_capacity IS NOT NULL AND slot_record.bike_capacity > 0 THEN
      INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
      VALUES (slot_record.id, bike_vehicle_id, slot_record.bike_capacity)
      ON CONFLICT (slot_id, vehicle_id) DO UPDATE SET capacity = EXCLUDED.capacity;
    END IF;
  END LOOP;
END $$;

-- Step 4: For slots without capacity data, create default capacity entries for all active vehicles
-- This ensures all slots have capacity entries for all vehicles
INSERT INTO slot_vehicle_capacity (slot_id, vehicle_id, capacity)
SELECT DISTINCT s.id, v.id, v.max_per_slot
FROM slots s
CROSS JOIN vehicles v
WHERE v.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM slot_vehicle_capacity svc 
    WHERE svc.slot_id = s.id AND svc.vehicle_id = v.id
  )
ON CONFLICT (slot_id, vehicle_id) DO NOTHING;

-- Step 5: Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_slot_vehicle_capacity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_slot_vehicle_capacity_updated_at
  BEFORE UPDATE ON slot_vehicle_capacity
  FOR EACH ROW
  EXECUTE FUNCTION update_slot_vehicle_capacity_updated_at();

-- Step 6: Add comments
COMMENT ON TABLE slot_vehicle_capacity IS 'Junction table storing capacity per vehicle per slot. Replaces hardcoded electric_capacity, petrol_capacity, bike_capacity columns.';
COMMENT ON COLUMN slot_vehicle_capacity.capacity IS 'Maximum number of this vehicle type that can be booked for this slot';

-- Step 7: Create function to get vehicle capacity for a slot
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

-- Step 8: Create function to ensure slot has capacity entries for all active vehicles
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
