/*
  # Database Seed Data

  Creates demo data for testing the application:
  - Demo admin user (superadmin@demo.com)
  - 4 Trainer profiles with different specializations
  - Multiple training slots for the next 7 days
  - Sample settings configuration

  Demo Credentials:
  - Superadmin: superadmin@demo.com (role: superadmin)
  - Admin: admin@demo.com (role: admin)
  - Trainer: trainer1@demo.com (role: trainer)
  - Customer: customer@demo.com (role: customer)

  Note: These are demo accounts for testing. In production, use Google OAuth.
*/

DO $$
DECLARE
  admin_user_id uuid;
  trainer1_id uuid;
  trainer2_id uuid;
  trainer3_id uuid;
  trainer4_id uuid;
  slot_date date;
  slot_time time;
  slot_start timestamptz;
  slot_end timestamptz;
BEGIN
  admin_user_id := 'a0000000-0000-0000-0000-000000000001'::uuid;
  trainer1_id := gen_random_uuid();
  trainer2_id := gen_random_uuid();
  trainer3_id := gen_random_uuid();
  trainer4_id := gen_random_uuid();

  INSERT INTO profiles (id, email, full_name, phone, role, avatar_url) VALUES
  (admin_user_id, 'superadmin@demo.com', 'Super Admin', '+91 98765 00001', 'superadmin', NULL),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'admin@demo.com', 'Admin User', '+91 98765 00002', 'admin', NULL),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'trainer1@demo.com', 'Rajesh Kumar', '+91 98765 43211', 'trainer', NULL),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'trainer2@demo.com', 'Anita Sharma', '+91 98765 43212', 'trainer', NULL),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'trainer3@demo.com', 'Vikram Singh', '+91 98765 43213', 'trainer', NULL),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'trainer4@demo.com', 'Priya Banerjee', '+91 98765 43214', 'trainer', NULL),
  ('a0000000-0000-0000-0000-000000000007'::uuid, 'customer@demo.com', 'Test Customer', '+91 98765 99999', 'customer', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO trainers (id, user_id, bio, experience_years, specialization, rating, total_sessions, is_active) VALUES
  (trainer1_id, 'a0000000-0000-0000-0000-000000000003'::uuid,
   'Experienced trainer specializing in beginner-friendly lessons',
   12, ARRAY['Beginner Training', 'Safety Protocols'], 4.9, 450, true),
  (trainer2_id, 'a0000000-0000-0000-0000-000000000004'::uuid,
   'Expert in defensive driving and advanced techniques',
   10, ARRAY['Advanced Training', 'Defensive Driving'], 4.8, 380, true),
  (trainer3_id, 'a0000000-0000-0000-0000-000000000005'::uuid,
   'Specialized in confidence building and road awareness',
   15, ARRAY['Confidence Building', 'Road Awareness'], 5.0, 520, true),
  (trainer4_id, 'a0000000-0000-0000-0000-000000000006'::uuid,
   'Focus on practical skills and real-world scenarios',
   8, ARRAY['Practical Skills', 'City Riding'], 4.9, 310, true)
  ON CONFLICT (id) DO NOTHING;

  FOR day_offset IN 0..6 LOOP
    slot_date := CURRENT_DATE + day_offset;

    FOR hour IN 9..20 LOOP
      FOREACH minute IN ARRAY ARRAY[0, 30] LOOP
        slot_time := make_time(hour, minute, 0);
        slot_start := (slot_date + slot_time)::timestamptz;
        slot_end := slot_start + interval '30 minutes';

        IF day_offset % 4 = 0 THEN
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
          VALUES (trainer1_id, slot_start, slot_end, 1, 0, 'available')
          ON CONFLICT DO NOTHING;
        ELSIF day_offset % 4 = 1 THEN
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
          VALUES (trainer2_id, slot_start, slot_end, 1, 0, 'available')
          ON CONFLICT DO NOTHING;
        ELSIF day_offset % 4 = 2 THEN
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
          VALUES (trainer3_id, slot_start, slot_end, 1, 0, 'available')
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status)
          VALUES (trainer4_id, slot_start, slot_end, 1, 0, 'available')
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  INSERT INTO settings (key, value, description, updated_by) VALUES
  ('cancellation_window_hours', '24'::jsonb, 'Hours before session to allow free cancellation', admin_user_id),
  ('allow_overbooking', 'false'::jsonb, 'Allow booking more than slot capacity', admin_user_id),
  ('session_duration_minutes', '30'::jsonb, 'Default session duration in minutes', admin_user_id),
  ('max_advance_booking_days', '14'::jsonb, 'Maximum days in advance to book', admin_user_id),
  ('business_hours_start', '"09:00"'::jsonb, 'Business hours start time', admin_user_id),
  ('business_hours_end', '"21:00"'::jsonb, 'Business hours end time', admin_user_id)
  ON CONFLICT (key) DO NOTHING;

END $$;
