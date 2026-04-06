-- =============================================================================
-- RECONC student_entitlements.used_slots FROM BOOKINGS
-- =============================================================================
-- Counts non-cancelled bookings per user, caps used_slots at total_slots,
-- fixes negative/null drift. Safe to run repeatedly.
-- Requires table student_entitlements to exist.
-- =============================================================================

BEGIN;

UPDATE student_entitlements se
SET used_slots = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.user_id = se.user_id
    AND b.status NOT IN ('cancelled')
);

WITH counts AS (
  SELECT user_id, COUNT(*)::int AS cnt
  FROM bookings
  WHERE status NOT IN ('cancelled')
  GROUP BY user_id
)
UPDATE student_entitlements se
SET used_slots = LEAST(COALESCE(c.cnt, 0), se.total_slots),
    updated_at = NOW()
FROM counts c
WHERE se.user_id = c.user_id;

UPDATE student_entitlements
SET used_slots = LEAST(used_slots, total_slots),
    updated_at = NOW()
WHERE used_slots > total_slots;

UPDATE student_entitlements
SET total_slots = GREATEST(total_slots, 0),
    used_slots = GREATEST(LEAST(used_slots, GREATEST(total_slots, 0)), 0),
    updated_at = NOW()
WHERE total_slots < 0 OR used_slots < 0;

COMMIT;
