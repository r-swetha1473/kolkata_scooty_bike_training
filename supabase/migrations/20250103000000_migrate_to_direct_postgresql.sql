-- Migration: Update slots table for direct PostgreSQL usage
-- This migration adds necessary columns and updates constraints to support
-- auto-generated slots and date-based queries

-- Step 1: Make trainer_id nullable (auto-generated slots don't have trainers initially)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'slots' 
        AND column_name = 'trainer_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- Drop the foreign key constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'slots_trainer_id_fkey' 
            AND table_name = 'slots'
        ) THEN
            ALTER TABLE slots DROP CONSTRAINT slots_trainer_id_fkey;
        END IF;
        
        -- Make column nullable
        ALTER TABLE slots ALTER COLUMN trainer_id DROP NOT NULL;
        
        -- Recreate foreign key with ON DELETE SET NULL
        ALTER TABLE slots ADD CONSTRAINT slots_trainer_id_fkey 
            FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 2: Add slot_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'slots' AND column_name = 'slot_date'
    ) THEN
        ALTER TABLE slots ADD COLUMN slot_date DATE;
        
        -- Populate slot_date from start_time for existing records
        UPDATE slots SET slot_date = start_time::date WHERE slot_date IS NULL;
        
        -- Make it NOT NULL after populating
        ALTER TABLE slots ALTER COLUMN slot_date SET NOT NULL;
    END IF;
END $$;

-- Step 3: Add is_auto_generated column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'slots' AND column_name = 'is_auto_generated'
    ) THEN
        ALTER TABLE slots ADD COLUMN is_auto_generated BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Step 4: Drop old unique constraint if it exists (requires trainer_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'slots_trainer_id_start_time_end_time_key'
    ) THEN
        ALTER TABLE slots DROP CONSTRAINT slots_trainer_id_start_time_end_time_key;
    END IF;
END $$;

-- Step 5: Create index on slot_date if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_slots_slot_date ON slots(slot_date);

-- Step 6: Create index on is_auto_generated if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_slots_is_auto_generated ON slots(is_auto_generated);

-- Step 7: Create function to automatically set slot_date from start_time
CREATE OR REPLACE FUNCTION set_slot_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slot_date IS NULL THEN
        NEW.slot_date = NEW.start_time::date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger to automatically set slot_date
DROP TRIGGER IF EXISTS trigger_set_slot_date ON slots;
CREATE TRIGGER trigger_set_slot_date
    BEFORE INSERT OR UPDATE OF start_time ON slots
    FOR EACH ROW
    EXECUTE FUNCTION set_slot_date();

-- Step 9: Add comment for documentation
COMMENT ON COLUMN slots.slot_date IS 'Date of the slot (extracted from start_time for easier querying)';
COMMENT ON COLUMN slots.is_auto_generated IS 'Indicates if the slot was auto-generated (not manually created)';
COMMENT ON COLUMN slots.trainer_id IS 'Trainer assigned to the slot (nullable for auto-generated slots)';

