-- Fix Admin Passwords Script
-- This script updates existing admin users that don't have password_hash
-- Password: admin123
-- Hash generated with: bcryptjs.hash('admin123', 10)

-- Update admin user
UPDATE profiles
SET password_hash = '$2a$10$f87h02FkekIgyRPNLBlKEuf3KbUWrlfVrpqSJXdJYymnuTv749gVO',
    updated_at = NOW()
WHERE email = 'admin@kolkatascotty.com'
  AND (password_hash IS NULL OR password_hash = '')
  AND role IN ('admin', 'superadmin');

-- Update superadmin user
UPDATE profiles
SET password_hash = '$2a$10$f87h02FkekIgyRPNLBlKEuf3KbUWrlfVrpqSJXdJYymnuTv749gVO',
    updated_at = NOW()
WHERE email = 'superadmin@kolkatascotty.com'
  AND (password_hash IS NULL OR password_hash = '')
  AND role = 'superadmin';

-- Verify the updates
SELECT email, full_name, role, 
       CASE 
         WHEN password_hash IS NULL THEN '❌ No password'
         WHEN password_hash = '' THEN '❌ Empty password'
         ELSE '✅ Password set'
       END as password_status
FROM profiles
WHERE email IN ('admin@kolkatascotty.com', 'superadmin@kolkatascotty.com')
  AND role IN ('admin', 'superadmin');

