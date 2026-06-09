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
