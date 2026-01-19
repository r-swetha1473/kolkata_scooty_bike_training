-- Migration: PHASE 4 - Admin Audit Log
-- Date: 2026-01-21
-- Description: Creates admin_audit_log table for tracking admin actions and overrides

-- Create admin_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'slot', 'booking', 'trainer', etc.
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- Add comments
COMMENT ON TABLE admin_audit_log IS 'Audit log for admin actions and overrides';
COMMENT ON COLUMN admin_audit_log.action_type IS 'Type of action: UPDATE_VEHICLE_CAPACITY, OVERRIDE_BOOKING, etc.';
COMMENT ON COLUMN admin_audit_log.entity_type IS 'Type of entity affected: slot, booking, trainer, etc.';
COMMENT ON COLUMN admin_audit_log.before_value IS 'JSON representation of state before change';
COMMENT ON COLUMN admin_audit_log.after_value IS 'JSON representation of state after change';
COMMENT ON COLUMN admin_audit_log.details IS 'Additional details about the action';
