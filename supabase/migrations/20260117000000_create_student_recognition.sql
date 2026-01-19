-- Migration: Create Student Recognition Table
-- Date: 2026-01-17
-- Description: Creates student_recognition table to track student invoice verification and approval status

-- Create student_recognition table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'student_recognition'
  ) THEN
    CREATE TABLE student_recognition (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      phone_number VARCHAR(20) NOT NULL,
      invoice_reference VARCHAR(255),
      invoice_file_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );

    -- Create indexes for performance
    CREATE INDEX idx_student_recognition_user_id ON student_recognition(user_id);
    CREATE INDEX idx_student_recognition_status ON student_recognition(status) WHERE status = 'approved';
    CREATE INDEX idx_student_recognition_user_status ON student_recognition(user_id, status);

    -- Add comments for documentation
    COMMENT ON TABLE student_recognition IS 'Tracks student invoice verification and approval status for booking eligibility';
    COMMENT ON COLUMN student_recognition.user_id IS 'Reference to the user profile';
    COMMENT ON COLUMN student_recognition.phone_number IS 'Phone number associated with the invoice';
    COMMENT ON COLUMN student_recognition.invoice_reference IS 'Invoice reference number';
    COMMENT ON COLUMN student_recognition.invoice_file_url IS 'URL to the uploaded invoice file';
    COMMENT ON COLUMN student_recognition.status IS 'Status: pending, approved, or rejected';
    COMMENT ON COLUMN student_recognition.created_at IS 'When the record was created';
    COMMENT ON COLUMN student_recognition.approved_at IS 'When the record was approved (NULL if not approved)';
  END IF;
END $$;
