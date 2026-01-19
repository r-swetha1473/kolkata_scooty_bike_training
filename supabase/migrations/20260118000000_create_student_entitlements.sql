-- Migration: Create Student Entitlements Table
-- Date: 2026-01-18
-- Description: Creates student_entitlements table to track student booking entitlements and usage

-- Create student_entitlements table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'student_entitlements'
  ) THEN
    CREATE TABLE student_entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      total_slots INTEGER NOT NULL DEFAULT 0 CHECK (total_slots >= 0),
      used_slots INTEGER NOT NULL DEFAULT 0 CHECK (used_slots >= 0),
      first_booking_date DATE,
      expiry_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      -- Ensure used_slots doesn't exceed total_slots
      CONSTRAINT student_entitlements_slots_check CHECK (used_slots <= total_slots)
    );

    -- Create indexes for performance
    CREATE INDEX idx_student_entitlements_user_id ON student_entitlements(user_id);
    CREATE INDEX idx_student_entitlements_expiry_date ON student_entitlements(expiry_date) WHERE expiry_date IS NOT NULL;
    CREATE INDEX idx_student_entitlements_active ON student_entitlements(user_id, expiry_date) 
      WHERE expiry_date IS NULL OR expiry_date >= CURRENT_DATE;

    -- Add comments for documentation
    COMMENT ON TABLE student_entitlements IS 'Tracks student booking entitlements, usage, and validity period';
    COMMENT ON COLUMN student_entitlements.user_id IS 'Reference to the user profile (one-to-one relationship)';
    COMMENT ON COLUMN student_entitlements.total_slots IS 'Total number of booking slots the student is entitled to';
    COMMENT ON COLUMN student_entitlements.used_slots IS 'Number of booking slots already used';
    COMMENT ON COLUMN student_entitlements.first_booking_date IS 'Date of the first booking made (used to calculate expiry)';
    COMMENT ON COLUMN student_entitlements.expiry_date IS 'Date when the entitlements expire (NULL if no expiry)';
    COMMENT ON COLUMN student_entitlements.created_at IS 'When the entitlement record was created';
    COMMENT ON COLUMN student_entitlements.updated_at IS 'When the entitlement record was last updated';
  END IF;
END $$;
