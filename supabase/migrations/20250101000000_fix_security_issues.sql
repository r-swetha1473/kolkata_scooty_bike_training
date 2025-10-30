/*
  # Fix Security and Performance Issues

  This migration addresses:
  1. Missing indexes on foreign keys
  2. RLS policy performance optimization (auth function initialization)
  3. Function search path security
  4. Multiple permissive policies consolidation

  ## Changes

  ### Indexes
  - Add indexes for foreign keys on bookings.cancelled_by and settings.updated_by

  ### RLS Policy Optimization
  - Update all RLS policies to use (select auth.<function>()) pattern for better performance
  - This prevents re-evaluation of auth functions for each row

  ### Security
  - Set immutable search_path for update_updated_at_column function

  ### Policy Consolidation
  - Combine multiple permissive policies into single policies where appropriate
*/

-- ============================================================================
-- 1. Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by
ON public.bookings(cancelled_by);

CREATE INDEX IF NOT EXISTS idx_settings_updated_by
ON public.settings(updated_by);

-- ============================================================================
-- 2. Fix Function Search Path Security
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Optimize RLS Policies - Profiles Table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Users and admins can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Users and admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 4. Optimize RLS Policies - Trainers Table
-- ============================================================================

DROP POLICY IF EXISTS "Trainers can view own profile" ON public.trainers;
DROP POLICY IF EXISTS "Admins can manage trainers" ON public.trainers;
DROP POLICY IF EXISTS "Anyone can view active trainers" ON public.trainers;

CREATE POLICY "View trainers policy"
ON public.trainers
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins manage trainers"
ON public.trainers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 5. Optimize RLS Policies - Slots Table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage slots" ON public.slots;
DROP POLICY IF EXISTS "Anyone can view available slots" ON public.slots;

CREATE POLICY "View and manage slots"
ON public.slots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage slots"
ON public.slots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 6. Optimize RLS Policies - Bookings Table
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Trainers can view assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;

CREATE POLICY "View bookings policy"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.trainers
    WHERE trainers.id = bookings.trainer_id
    AND trainers.user_id = (SELECT auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Create bookings policy"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Update bookings policy"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Delete bookings policy"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 7. Optimize RLS Policies - Audit Logs Table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 8. Optimize RLS Policies - Settings Table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;

CREATE POLICY "View settings policy"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Manage settings policy"
ON public.settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'superadmin')
  )
);

-- ============================================================================
-- 9. Add Comments for Documentation
-- ============================================================================

COMMENT ON INDEX idx_bookings_cancelled_by IS
'Index for foreign key bookings.cancelled_by to improve query performance';

COMMENT ON INDEX idx_settings_updated_by IS
'Index for foreign key settings.updated_by to improve query performance';

COMMENT ON FUNCTION public.update_updated_at_column IS
'Trigger function to automatically update updated_at column with secure search_path';

-- ============================================================================
-- 10. Analyze Tables for Query Planner
-- ============================================================================

ANALYZE public.profiles;
ANALYZE public.trainers;
ANALYZE public.slots;
ANALYZE public.bookings;
ANALYZE public.audit_logs;
ANALYZE public.settings;
