-- Migration: Add Performance Indexes
-- Date: 2026-01-25
-- Description: Adds missing indexes for query performance optimization

-- Index for vehicle capacity checks (bookings by slot, vehicle, status)
CREATE INDEX IF NOT EXISTS idx_bookings_slot_vehicle_status 
ON bookings(slot_id, vehicle_id, status) 
WHERE status NOT IN ('cancelled');

-- Index for weekly limit checks (phone + slot_date)
-- Note: This requires joining with slots table to get slot_date
-- Alternative: Add slot_date to bookings table or use existing index
CREATE INDEX IF NOT EXISTS idx_bookings_phone_created_week 
ON bookings(phone, created_at) 
WHERE phone IS NOT NULL AND status NOT IN ('cancelled');

-- Index for slot_vehicle_capacity lookups (if not already exists from main migration)
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_vehicle 
ON slot_vehicle_capacity(slot_id, vehicle_id);

-- Index for student entitlements lookups
CREATE INDEX IF NOT EXISTS idx_student_entitlements_user_id 
ON student_entitlements(user_id);

-- Index for student recognition lookups
CREATE INDEX IF NOT EXISTS idx_student_recognition_user_id 
ON student_recognition(user_id);

-- Index for student recognition status checks
CREATE INDEX IF NOT EXISTS idx_student_recognition_user_status 
ON student_recognition(user_id, status, created_at DESC);

COMMENT ON INDEX idx_bookings_slot_vehicle_status IS 'Optimizes vehicle capacity checks during booking creation';
COMMENT ON INDEX idx_bookings_phone_created_week IS 'Optimizes weekly booking limit checks';
COMMENT ON INDEX idx_slot_vehicle_capacity_slot_vehicle IS 'Optimizes slot vehicle capacity lookups';
