-- Initialize Kolkata Scotty Database Schema
-- Creates the complete database schema for the bike training booking system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'trainer', 'admin', 'superadmin')) DEFAULT 'customer',
  password_hash TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trainers table
CREATE TABLE IF NOT EXISTS trainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  specialization TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(3, 2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_sessions INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  on_duty BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Slots table
CREATE TABLE IF NOT EXISTS slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status TEXT NOT NULL CHECK (status IN ('available', 'full', 'cancelled', 'completed')) DEFAULT 'available',
  is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (booked_count <= capacity)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'pending',
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON trainers(user_id);
CREATE INDEX IF NOT EXISTS idx_trainers_is_active ON trainers(is_active);
CREATE INDEX IF NOT EXISTS idx_trainers_on_duty ON trainers(on_duty);
CREATE INDEX IF NOT EXISTS idx_slots_trainer_id ON slots(trainer_id);
CREATE INDEX IF NOT EXISTS idx_slots_start_time ON slots(start_time);
CREATE INDEX IF NOT EXISTS idx_slots_slot_date ON slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON bookings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Unique constraints for slots
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_unassigned
  ON slots(start_time, end_time)
  WHERE trainer_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_assigned
  ON slots(trainer_id, start_time, end_time)
  WHERE trainer_id IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainers_updated_at BEFORE UPDATE ON trainers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically set slot_date
CREATE OR REPLACE FUNCTION set_slot_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slot_date = NEW.start_time::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_slot_date
  BEFORE INSERT OR UPDATE OF start_time ON slots
  FOR EACH ROW
  EXECUTE FUNCTION set_slot_date();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users and admins can view profiles" ON profiles;
CREATE POLICY "Users and admins can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Users and admins can update profiles" ON profiles;
CREATE POLICY "Users and admins can update profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- RLS Policies for trainers
DROP POLICY IF EXISTS "View trainers policy" ON trainers;
CREATE POLICY "View trainers policy"
ON trainers FOR SELECT
TO authenticated
USING (
  is_active = true
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Admins manage trainers" ON trainers;
CREATE POLICY "Admins manage trainers"
ON trainers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- RLS Policies for slots
DROP POLICY IF EXISTS "View slots policy" ON slots;
CREATE POLICY "View slots policy"
ON slots FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage slots" ON slots;
CREATE POLICY "Admins manage slots"
ON slots FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- RLS Policies for bookings
DROP POLICY IF EXISTS "View bookings policy" ON bookings;
CREATE POLICY "View bookings policy"
ON bookings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM trainers
    WHERE trainers.id = bookings.trainer_id
    AND trainers.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Create bookings policy" ON bookings;
CREATE POLICY "Create bookings policy"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Update bookings policy" ON bookings;
CREATE POLICY "Update bookings policy"
ON bookings FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Delete bookings policy" ON bookings;
CREATE POLICY "Delete bookings policy"
ON bookings FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- RLS Policies for audit_logs
DROP POLICY IF EXISTS "Admins view audit logs" ON audit_logs;
CREATE POLICY "Admins view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Admins insert audit logs" ON audit_logs;
CREATE POLICY "Admins insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- RLS Policies for settings
DROP POLICY IF EXISTS "View settings policy" ON settings;
CREATE POLICY "View settings policy"
ON settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Manage settings policy" ON settings;
CREATE POLICY "Manage settings policy"
ON settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )
);

-- Initialize default settings
INSERT INTO settings (key, value, description) VALUES
  ('site_name', '"Kolkata Scotty"', 'The name of the website'),
  ('site_logo', '""', 'URL to the site logo'),
  ('contact_email', '"contact@kolkatascotty.com"', 'Primary contact email'),
  ('contact_phone', '"+91 1234567890"', 'Primary contact phone number'),
  ('contact_address', '"Kolkata, West Bengal, India"', 'Business address'),
  ('social_facebook', '""', 'Facebook page URL'),
  ('social_instagram', '""', 'Instagram profile URL'),
  ('social_youtube', '""', 'YouTube channel URL'),
  ('footer_copyright', '"© 2025 Kolkata Scotty. All rights reserved."', 'Footer copyright text'),
  ('about_text', '"We are dedicated to providing quality bike training services in Kolkata."', 'About section text')
ON CONFLICT (key) DO NOTHING;
