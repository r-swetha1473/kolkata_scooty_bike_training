-- Allow aggregate slot capacity to follow SUM(max_per_slot) across active vehicles (e.g. 7+).
-- Drops legacy capacity = 5 constraint that blocks recalculation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'slots_capacity_check'
  ) THEN
    ALTER TABLE slots DROP CONSTRAINT slots_capacity_check;
  END IF;
END $$;

ALTER TABLE slots
  ADD CONSTRAINT slots_capacity_check
  CHECK (capacity >= 1 AND capacity <= 100);

COMMENT ON CONSTRAINT slots_capacity_check ON slots IS
  'Aggregate slot capacity; auto-calculated as SUM(vehicles.max_per_slot) when enabled.';
