-- Migration: Add first_booking_date to student_entitlements
-- Date: 2026-01-25
-- Description: Adds first_booking_date column referenced in booking creation code

ALTER TABLE student_entitlements 
ADD COLUMN IF NOT EXISTS first_booking_date DATE;

COMMENT ON COLUMN student_entitlements.first_booking_date IS 'Date of first booking made by user (used for entitlement tracking and expiry calculations)';
