-- Account reactivation requests (customer-initiated; admin approve/reject)
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

COMMENT ON TABLE account_reactivation_requests IS 'Customer reactivation requests when inactive_blocked is true';
