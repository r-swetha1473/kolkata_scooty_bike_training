-- Phase 2: Sub Admin RBAC + permissions table

-- Add subadmin role to profiles
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'profiles'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%role%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'trainer', 'admin', 'superadmin', 'subadmin'));

-- Admin activation flag (admin, superadmin, subadmin)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Per-module permissions for sub admins
CREATE TABLE IF NOT EXISTS sub_admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN (
    'dashboard', 'users', 'trainers', 'vehicles', 'bookings', 'slots', 'audit_logs', 'settings'
  )),
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, module)
);

CREATE INDEX IF NOT EXISTS idx_sub_admin_permissions_profile
  ON sub_admin_permissions (profile_id);

-- Allow auth audit entries without a resolved profile (failed login)
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
