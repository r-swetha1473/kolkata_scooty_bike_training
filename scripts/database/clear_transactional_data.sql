-- =============================================================================
-- CLEAR TRANSACTIONAL DATA (keep schema, profiles, trainers, vehicles, etc.)
-- =============================================================================
-- Run in a maintenance window. Backup first.
-- Removes: bookings, slots (and slot_vehicle_capacity), ratings tied to bookings,
--          student_entitlements rows, legacy audit_logs, admin_audit_log.
--
-- Does NOT truncate: profiles, trainers, vehicles, admins, settings, student_recognition, …
-- =============================================================================

BEGIN;

-- Ratings reference bookings
DO $$
BEGIN
  IF to_regclass('public.ratings') IS NOT NULL THEN
    TRUNCATE TABLE ratings RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- Bookings reference slots and profiles
TRUNCATE TABLE bookings RESTART IDENTITY CASCADE;

-- Per-slot vehicle capacity rows reference slots
DO $$
BEGIN
  IF to_regclass('public.slot_vehicle_capacity') IS NOT NULL THEN
    TRUNCATE TABLE slot_vehicle_capacity RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- Slots (confirmed empty of bookings)
TRUNCATE TABLE slots RESTART IDENTITY CASCADE;

-- Entitlements (optional feature table)
DO $$
BEGIN
  IF to_regclass('public.student_entitlements') IS NOT NULL THEN
    TRUNCATE TABLE student_entitlements RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- Audit tables
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    TRUNCATE TABLE admin_audit_log RESTART IDENTITY CASCADE;
  END IF;
END $$;

COMMIT;

-- Optional: reset weekly counters on profiles if you use them (uncomment if desired)
-- UPDATE profiles SET weekly_booking_count = 0, weekly_reset_date = NULL WHERE true;
