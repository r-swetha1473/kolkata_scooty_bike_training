-- Migration: PHASE 5 - Phone Number Unique Constraint
-- Date: 2026-01-22
-- Description: Enforces phone number as unique identity per business rule
-- Fix: MBR-007 - Phone number = unique identity not enforced at DB level

-- Step 1: Remove any duplicate phone numbers (keep the oldest profile)
-- This is a safety measure before adding the constraint
DO $$
DECLARE
  duplicate_phone TEXT;
BEGIN
  -- Find and handle duplicate phone numbers
  FOR duplicate_phone IN
    SELECT phone
    FROM profiles
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest profile (lowest id or created_at), delete/update others
    -- For now, we'll set phone to NULL for duplicates (safer than deleting)
    UPDATE profiles
    SET phone = NULL,
        updated_at = NOW()
    WHERE phone = duplicate_phone
      AND id NOT IN (
        SELECT id
        FROM profiles
        WHERE phone = duplicate_phone
        ORDER BY created_at ASC
        LIMIT 1
      );
    
    RAISE NOTICE 'Handled duplicate phone: %', duplicate_phone;
  END LOOP;
END $$;

-- Step 2: Add UNIQUE constraint on phone column (non-null values only)
-- Using partial unique index to allow multiple NULL values but enforce uniqueness on non-NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON profiles(phone) 
WHERE phone IS NOT NULL;

-- Step 3: Add comment for documentation
COMMENT ON INDEX idx_profiles_phone_unique IS 'Enforces phone number uniqueness as per business rule: phone number = unique identity';
