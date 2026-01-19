-- Migration: Create ratings table
-- Date: 2026-01-25
-- Description: Creates ratings table for trainer ratings feature

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ratings_trainer_id ON ratings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_booking_id ON ratings(booking_id);

-- Add trigger for updated_at
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE ratings IS 'Trainer ratings submitted by users after booking completion';
COMMENT ON COLUMN ratings.rating IS 'Rating value from 1 to 5';
COMMENT ON COLUMN ratings.booking_id IS 'Booking this rating is for (one rating per booking per user)';
COMMENT ON COLUMN ratings.trainer_id IS 'Trainer being rated';
COMMENT ON COLUMN ratings.user_id IS 'User who submitted the rating';
