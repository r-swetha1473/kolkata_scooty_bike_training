/*
  # Clean Seed Data for Kolkata Scotty

  Creates demo data for testing:
  - Admin users (for email/password login)
  - Customer profiles
  - Trainers with specializations
  - Time slots for next 7 days
  - Sample bookings
  - System settings

  IMPORTANT:
  1. Run migrations first
  2. Create admin users in Supabase Auth dashboard
  3. Run this seed file
*/

-- Clean existing data
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE bookings CASCADE;
TRUNCATE TABLE slots CASCADE;
TRUNCATE TABLE trainers CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- =============================================
-- 1. PROFILES (Admin & Customers)
-- =============================================

-- Note: Admin user IDs will be replaced after creating in Supabase Auth
-- Placeholder IDs for now
INSERT INTO profiles (id, email, full_name, phone, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@kolkatascotty.com', 'Admin User', '+91 98765 00001', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'superadmin@kolkatascotty.com', 'Super Admin', '+91 98765 00002', 'superadmin');

-- Demo customers
INSERT INTO profiles (id, email, full_name, phone, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'customer1@example.com', 'Raj Kumar', '+91 98765 11111', 'customer'),
  ('10000000-0000-0000-0000-000000000002', 'customer2@example.com', 'Priya Singh', '+91 98765 22222', 'customer'),
  ('10000000-0000-0000-0000-000000000003', 'customer3@example.com', 'Amit Sharma', '+91 98765 33333', 'customer');

-- Demo trainer profiles
INSERT INTO profiles (id, email, full_name, phone, role) VALUES
  ('20000000-0000-0000-0000-000000000001', 'rajesh.mehta@kolkatascotty.com', 'Rajesh Mehta', '+91 98765 91111', 'trainer'),
  ('20000000-0000-0000-0000-000000000002', 'sanjay.das@kolkatascotty.com', 'Sanjay Das', '+91 98765 92222', 'trainer'),
  ('20000000-0000-0000-0000-000000000003', 'vikram.patel@kolkatascotty.com', 'Vikram Patel', '+91 98765 93333', 'trainer');

-- =============================================
-- 2. TRAINERS
-- =============================================

INSERT INTO trainers (user_id, bio, experience_years, specialization, rating, total_sessions, is_active) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'Expert bike trainer with 10+ years of experience. Specializes in beginners and highway riding.',
    10,
    ARRAY['Beginner Training', 'Highway Riding', 'License Test Prep'],
    4.8,
    450,
    true
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Professional instructor focused on safety and defensive riding techniques.',
    8,
    ARRAY['Safety Training', 'Defensive Riding', 'Advanced Skills'],
    4.9,
    380,
    true
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'Experienced trainer specializing in sports bikes and advanced maneuvers.',
    6,
    ARRAY['Sports Bikes', 'Advanced Maneuvers', 'City Traffic'],
    4.7,
    290,
    true
  );

-- =============================================
-- 3. TIME SLOTS (Next 7 Days)
-- =============================================

DO $$
DECLARE
  trainer1_id UUID;
  trainer2_id UUID;
  trainer3_id UUID;
  slot_date DATE;
BEGIN
  -- Get trainer IDs
  SELECT id INTO trainer1_id FROM trainers WHERE user_id = '20000000-0000-0000-0000-000000000001';
  SELECT id INTO trainer2_id FROM trainers WHERE user_id = '20000000-0000-0000-0000-000000000002';
  SELECT id INTO trainer3_id FROM trainers WHERE user_id = '20000000-0000-0000-0000-000000000003';

  -- Create slots for next 7 days
  FOR i IN 0..6 LOOP
    slot_date := CURRENT_DATE + i;

    -- Morning slots
    INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status) VALUES
      (trainer1_id, slot_date + TIME '09:00', slot_date + TIME '10:00', 3, 0, 'available'),
      (trainer1_id, slot_date + TIME '10:00', slot_date + TIME '11:00', 3, 0, 'available'),
      (trainer2_id, slot_date + TIME '09:00', slot_date + TIME '10:00', 2, 0, 'available'),
      (trainer2_id, slot_date + TIME '10:00', slot_date + TIME '11:00', 2, 0, 'available');

    -- Afternoon slots
    INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status) VALUES
      (trainer2_id, slot_date + TIME '14:00', slot_date + TIME '15:00', 2, 0, 'available'),
      (trainer3_id, slot_date + TIME '14:00', slot_date + TIME '15:00', 3, 0, 'available'),
      (trainer3_id, slot_date + TIME '15:00', slot_date + TIME '16:00', 3, 0, 'available');

    -- Evening slots
    INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status) VALUES
      (trainer1_id, slot_date + TIME '18:00', slot_date + TIME '19:00', 3, 0, 'available'),
      (trainer3_id, slot_date + TIME '18:00', slot_date + TIME '19:00', 3, 0, 'available');
  END LOOP;
END $$;

-- =============================================
-- 4. SAMPLE BOOKINGS
-- =============================================

DO $$
DECLARE
  slot_id UUID;
  trainer_id UUID;
BEGIN
  -- Get a slot from today
  SELECT s.id, s.trainer_id INTO slot_id, trainer_id
  FROM slots s
  WHERE DATE(s.start_time) = CURRENT_DATE
  AND TIME(s.start_time) = '09:00:00'
  LIMIT 1;

  -- Create sample bookings
  IF slot_id IS NOT NULL THEN
    INSERT INTO bookings (user_id, slot_id, trainer_id, status, notes) VALUES
      ('10000000-0000-0000-0000-000000000001', slot_id, trainer_id, 'confirmed', 'First time learner');

    UPDATE slots SET booked_count = 1 WHERE id = slot_id;
  END IF;
END $$;

-- =============================================
-- 5. SYSTEM SETTINGS
-- =============================================

INSERT INTO settings (key, value, description, updated_by) VALUES
  (
    'business_hours',
    '{"monday": "09:00-20:00", "tuesday": "09:00-20:00", "wednesday": "09:00-20:00", "thursday": "09:00-20:00", "friday": "09:00-20:00", "saturday": "09:00-20:00", "sunday": "10:00-18:00"}'::jsonb,
    'Business operating hours',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'booking_settings',
    '{"advance_booking_days": 30, "cancellation_hours": 24, "max_bookings_per_user": 5}'::jsonb,
    'Booking configuration',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'pricing',
    '{"per_session": 500, "package_5": 2250, "package_10": 4000}'::jsonb,
    'Session pricing',
    '00000000-0000-0000-0000-000000000001'
  );

-- =============================================
-- SUMMARY
-- =============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Seed Data Created Successfully!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Profiles: %', (SELECT COUNT(*) FROM profiles);
  RAISE NOTICE 'Trainers: %', (SELECT COUNT(*) FROM trainers);
  RAISE NOTICE 'Slots: %', (SELECT COUNT(*) FROM slots);
  RAISE NOTICE 'Bookings: %', (SELECT COUNT(*) FROM bookings);
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'NEXT STEPS: Create Admin Users';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. Go to Supabase Dashboard';
  RAISE NOTICE '   Authentication > Users > Add User';
  RAISE NOTICE '';
  RAISE NOTICE '2. Create admin user:';
  RAISE NOTICE '   Email: admin@kolkatascotty.com';
  RAISE NOTICE '   Password: admin123';
  RAISE NOTICE '   Auto Confirm: Yes';
  RAISE NOTICE '';
  RAISE NOTICE '3. Link to profile (replace USER_ID):';
  RAISE NOTICE '   UPDATE profiles';
  RAISE NOTICE '   SET id = ''USER_ID''';
  RAISE NOTICE '   WHERE email = ''admin@kolkatascotty.com'';';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test admin login:';
  RAISE NOTICE '   Visit: /admin/login';
  RAISE NOTICE '   Use admin@kolkatascotty.com / admin123';
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
END $$;
