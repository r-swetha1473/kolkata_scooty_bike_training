-- Migration: Create admins table for Admin and Super Admin management
-- Date: 2026-01-25
-- Description: Creates separate admins table with roles ADMIN and SUPER_ADMIN
--              Links to profiles table for user information

-- Step 1: Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPER_ADMIN')) DEFAULT 'ADMIN',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admins_profile_id ON admins(profile_id);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admins_created_by ON admins(created_by);

-- Step 3: Add trigger for updated_at timestamp
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Add comments
COMMENT ON TABLE admins IS 'Admin and Super Admin accounts with role-based access control';
COMMENT ON COLUMN admins.profile_id IS 'Reference to profiles table for user information';
COMMENT ON COLUMN admins.role IS 'Admin role: ADMIN or SUPER_ADMIN';
COMMENT ON COLUMN admins.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN admins.is_active IS 'Whether admin account is active';
COMMENT ON COLUMN admins.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN admins.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN admins.locked_until IS 'Account lock expiry timestamp (null if not locked)';
COMMENT ON COLUMN admins.created_by IS 'Admin who created this admin account (SUPER_ADMIN only)';

-- Step 5: Create function to check if admin can perform action
CREATE OR REPLACE FUNCTION can_admin_perform_action(
  p_admin_id UUID,
  p_required_role TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_admin_role, v_is_active
  FROM admins
  WHERE id = p_admin_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF NOT v_is_active THEN
    RETURN FALSE;
  END IF;
  
  -- SUPER_ADMIN can do everything
  IF v_admin_role = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;
  
  -- ADMIN can only perform ADMIN-level actions
  IF p_required_role = 'ADMIN' AND v_admin_role = 'ADMIN' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_admin_perform_action IS 'Checks if admin has permission to perform action based on role';
