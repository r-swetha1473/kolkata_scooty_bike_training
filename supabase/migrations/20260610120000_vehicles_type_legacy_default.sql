-- Legacy vehicles.type: NOT NULL on production Neon; app uses vehicle_id + name.
-- Default + comment so inserts without explicit type do not fail.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'type'
  ) THEN
    ALTER TABLE vehicles ALTER COLUMN type SET DEFAULT 'Scooty';

    UPDATE vehicles SET type = 'Bike'
    WHERE type IS NULL AND name ~* '\mbike\M';

    UPDATE vehicles SET type = 'Scooty' WHERE type IS NULL;

    COMMENT ON COLUMN vehicles.type IS 'Deprecated legacy field (Scooty|Bike). Inferred from name on create; use vehicle_id for bookings.';
  END IF;
END $$;
