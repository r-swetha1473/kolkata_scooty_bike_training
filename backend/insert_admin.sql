-- Insert Admin User Script
-- This script adds password_hash column if it doesn't exist and inserts the admin user

-- Step 1: Add password_hash column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE profiles ADD COLUMN password_hash TEXT;
        RAISE NOTICE 'Added password_hash column to profiles table';
    ELSE
        RAISE NOTICE 'password_hash column already exists';
    END IF;
END $$;

-- Step 2: Insert admin user (or update if exists)
-- Password: admin123
-- Hash generated with: bcryptjs.hash('admin123', 10)
INSERT INTO profiles (email, full_name, phone, role, password_hash)
VALUES (
  'admin@kolkatascotty.com',
  'Admin User',
  '+91 98765 00001',
  'admin',
  '$2a$10$f87h02FkekIgyRPNLBlKEuf3KbUWrlfVrpqSJXdJYymnuTv749gVO'
)
ON CONFLICT (email) 
DO UPDATE SET
  role = 'admin',
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  updated_at = NOW();

-- Step 3: Verify insertion
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count 
    FROM profiles 
    WHERE email = 'admin@kolkatascotty.com' AND role = 'admin';
    
    IF admin_count > 0 THEN
        RAISE NOTICE 'Admin user created/updated successfully!';
        RAISE NOTICE 'Email: admin@kolkatascotty.com';
        RAISE NOTICE 'Password: admin123';
    ELSE
        RAISE EXCEPTION 'Failed to create admin user';
    END IF;
END $$;

