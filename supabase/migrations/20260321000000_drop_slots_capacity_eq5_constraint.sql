-- Safe refactor: drop capacity = 5 CHECK so total capacity can follow slot_vehicle_capacity sums
-- while keeping booked_count <= capacity (see slots_booked_count_check).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'slots_capacity_check'
  ) THEN
    ALTER TABLE slots DROP CONSTRAINT slots_capacity_check;
  END IF;
END $$;

COMMENT ON TABLE slots IS 'Training slots; per-vehicle limits live in slot_vehicle_capacity';
