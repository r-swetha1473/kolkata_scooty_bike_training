/*
  # Add Unique Constraint to Slots Table

  Prevents duplicate slots for the same trainer at the same time.
  This ensures data integrity and allows seed.sql to work properly with ON CONFLICT.
*/

-- Add unique constraint to prevent duplicate trainer/time slots
ALTER TABLE public.slots
ADD CONSTRAINT slots_trainer_time_unique 
UNIQUE (trainer_id, start_time, end_time);

-- Add comment for documentation
COMMENT ON CONSTRAINT slots_trainer_time_unique ON public.slots IS
'Prevents duplicate training slots for the same trainer at the same time';

