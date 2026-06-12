-- =============================================================================
-- NEON PRODUCTION RECOVERY — Run in SQL Editor in this exact order
-- Database: kolkata_bike_training (production)
-- Pre-check: profiles, bookings, slots, vehicles, settings must exist
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 0: Pre-flight compatibility (run first, inspect results)
-- -----------------------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

SELECT role, COUNT(*)::int AS count FROM profiles GROUP BY role ORDER BY count DESC;

-- -----------------------------------------------------------------------------
-- STEP 1: Phase 4 — Admin Audit Log (20260121000000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- -----------------------------------------------------------------------------
-- STEP 2: Phase 2 RBAC — Sub Admin (20260609120000)
-- Requires: admin_audit_log from Step 1
-- -----------------------------------------------------------------------------
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

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_is_active BOOLEAN NOT NULL DEFAULT TRUE;

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

ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- STEP 3: Admin Password Management (20260609130000)
-- -----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- -----------------------------------------------------------------------------
-- STEP 4: Auto Slot Capacity Setting (20260609140000)
-- -----------------------------------------------------------------------------
INSERT INTO settings (key, value, description)
VALUES (
  'auto_slot_capacity_from_vehicles',
  'true',
  'Auto calculate slot capacity from active vehicles'
)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- STEP 5: Admin Notifications (20260609150000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_notification_reads (
  notification_id UUID NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created
  ON admin_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_admin
  ON admin_notification_reads(admin_id);

-- -----------------------------------------------------------------------------
-- STEP 6: Account Reactivation Requests (20260612120000)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_reactivation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  user_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactivation_one_pending_per_user
  ON account_reactivation_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reactivation_requests_status_requested
  ON account_reactivation_requests (status, requested_at DESC);

-- -----------------------------------------------------------------------------
-- STEP 7: Promote existing admin to superadmin (REQUIRED for Audit/Settings/Sub Admins menus)
-- Replace email with your production admin email before running:
-- -----------------------------------------------------------------------------
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'admin@yourdomain.com' AND role = 'admin';

-- -----------------------------------------------------------------------------
-- STEP 8: Post-migration verification (all should return true)
-- -----------------------------------------------------------------------------
SELECT
  to_regclass('public.admin_audit_log') IS NOT NULL AS audit_logs_ok,
  to_regclass('public.sub_admin_permissions') IS NOT NULL AS rbac_ok,
  to_regclass('public.admin_notifications') IS NOT NULL AS notifications_ok,
  to_regclass('public.account_reactivation_requests') IS NOT NULL AS reactivation_requests_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='profiles' AND column_name='must_change_password') AS password_mgmt_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='profiles' AND column_name='admin_is_active') AS admin_active_ok,
  EXISTS (SELECT 1 FROM settings WHERE key='auto_slot_capacity_from_vehicles') AS slot_capacity_setting_ok,
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid='profiles'::regclass AND pg_get_constraintdef(oid) LIKE '%subadmin%') AS subadmin_role_ok;
