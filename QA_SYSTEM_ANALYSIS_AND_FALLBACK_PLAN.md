# QA System Analysis and Fallback Plan
## Kolkata Scooty Bike Training Booking System

**Document Version:** 1.0  
**Date:** 2026-01-19  
**Prepared By:** Senior QA Lead & System Analyst  
**System:** Bike Training Booking Platform (Angular Frontend + Node.js Backend + PostgreSQL)

---

## Table of Contents

1. [End-to-End System Flow](#1-end-to-end-system-flow)
2. [Business Rule Validation](#2-business-rule-validation)
3. [Slot Generation Logic](#3-slot-generation-logic)
4. [Failure & Fallback Scenarios](#4-failure--fallback-scenarios)
5. [Edge Cases](#5-edge-cases)
6. [Data Consistency Checks](#6-data-consistency-checks)
7. [Enhancement-Safe Strategy](#7-enhancement-safe-strategy)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. END-TO-END SYSTEM FLOW

### 1.1 User Journey: Registration → Booking → Cancellation

#### **Phase 1: User Registration & Recognition**

**Frontend Flow:**
1. User visits `/booking` page
2. Clicks "Sign in with Google" → Redirects to Google OAuth
3. Google OAuth callback → Backend `/api/auth/google/callback`
4. Backend creates/updates user profile in `profiles` table
5. Backend sets httpOnly cookie `auth_token` with JWT
6. Redirects to `/profile` (no token in URL)

**Backend Processing (`backend/routes/auth.js`):**
- Passport.js handles OAuth authentication
- Creates user if doesn't exist (role: 'customer')
- Generates JWT token (7-day expiry)
- Stores token in httpOnly cookie (secure)
- Updates `profiles` table with Google ID

**Database Changes:**
- `profiles` table: INSERT or UPDATE with `google_id`, `email`, `full_name`
- Phone number initially NULL (will be required for booking)

**Critical Points:**
- ✅ No token exposure in URL
- ✅ Phone number not required at registration (required later for booking)
- ⚠️ User must submit student recognition before booking

---

#### **Phase 2: Student Recognition (Pre-Booking Requirement)**

**Frontend Flow:**
1. User navigates to profile page
2. Submits invoice with phone number via `/api/recognition` POST
3. Status shows as "pending" until admin approval

**Backend Processing (`backend/routes/recognition.js`):**
- Validates phone number format (10 digits)
- Checks for existing recognition (prevents duplicate approved submissions)
- Creates/updates `student_recognition` record with status='pending'
- Admin must approve via PUT `/api/recognition/:id/approve`

**Database Changes:**
- `student_recognition` table: INSERT with status='pending'
- `profiles` table: Phone number updated if provided

**Critical Points:**
- ⚠️ User cannot book until recognition is 'approved'
- ⚠️ Only one approved recognition per user allowed
- ⚠️ Rejected/pending recognitions can be resubmitted

---

#### **Phase 3: Student Entitlements Setup**

**Backend Processing (Automatic on First Booking):**
- When first booking is created, `student_entitlements` record is created
- `first_booking_date` = CURRENT_DATE
- `expiry_date` = CURRENT_DATE + 30 days
- `total_slots` and `used_slots` managed by admin

**Database Changes:**
- `student_entitlements` table: INSERT on first booking
- Entitlements checked BEFORE booking creation

**Critical Points:**
- ⚠️ Entitlements must exist and be valid before booking
- ⚠️ `used_slots` must be < `total_slots`
- ⚠️ `expiry_date` must be >= CURRENT_DATE

---

#### **Phase 4: Slot Selection & Booking**

**Frontend Flow (`src/app/pages/booking/booking.component.ts`):**
1. User selects date (prevents past dates)
2. Frontend calls `GET /api/slots?date=YYYY-MM-DD`
3. Filters slots by:
   - `is_visible = true` (24-hour rule)
   - `status = 'available'`
   - `booked_count < capacity`
   - `trainer_id IS NOT NULL`
   - `trainer.is_active = true`
4. User selects slot → Opens booking modal
5. User selects trainer and vehicle
6. User enters phone number (if not already set)
7. CAPTCHA verification required
8. Submits booking via `POST /api/bookings`

**Backend Processing (`backend/routes/bookings.js`):**
```
Transaction Flow:
1. BEGIN TRANSACTION
2. Check student_recognition.status = 'approved' (REQUIRED)
3. Check student_entitlements:
   - expiry_date >= CURRENT_DATE
   - used_slots < total_slots
4. Check weekly booking limit (1 booking per week)
5. Check total booking limit (max 2 active bookings)
6. Validate slot availability:
   - Slot exists and is visible
   - Slot status = 'available' or 'full' (but booked_count < capacity)
   - Slot start_time >= NOW() + 24 hours
   - Trainer is active
7. Atomic booking creation:
   - SELECT slot FOR UPDATE (row-level lock)
   - INSERT booking
   - UPDATE slot.booked_count += 1
   - UPDATE slot.status = 'full' if booked_count >= capacity
   - UPDATE slot.trainer_id if NULL
8. Increment weekly booking count
9. Update entitlement used_slots
10. COMMIT TRANSACTION
```

**Database Changes:**
- `bookings` table: INSERT with status='confirmed'
- `slots` table: UPDATE booked_count, status
- `profiles` table: UPDATE weekly_booking_count, total_bookings
- `student_entitlements` table: UPDATE used_slots

**Critical Points:**
- ✅ Atomic transaction prevents race conditions
- ✅ Row-level locking (`FOR UPDATE`) prevents double-booking
- ⚠️ Weekly limit: 1 booking per week (Monday-Sunday)
- ⚠️ Total limit: Max 2 active bookings (not cancelled)
- ⚠️ 24-hour advance booking required

---

#### **Phase 5: Booking Cancellation**

**Frontend Flow:**
1. User views bookings in `/profile`
2. Clicks cancel on eligible booking
3. Frontend validates cancellation window (5 hours before slot)
4. Submits `PUT /api/bookings/:id/cancel` with reason

**Backend Processing (`backend/routes/bookings.js`):**
```
Transaction Flow:
1. BEGIN TRANSACTION
2. Verify booking belongs to user (user_id check)
3. Check cancellation window:
   - slot.start_time - NOW() > 5 hours
   - Database function: can_cancel_booking(booking_id)
4. Update booking:
   - status = 'cancelled'
   - cancelled_at = NOW()
   - cancelled_by = user_id
   - cancellation_reason = reason
5. Decrement slot.booked_count
6. Update slot.status if booked_count = 0
7. COMMIT TRANSACTION
```

**Database Changes:**
- `bookings` table: UPDATE status='cancelled', cancelled_at, cancelled_by
- `slots` table: UPDATE booked_count -= 1, status

**Critical Points:**
- ⚠️ Cancellation only allowed > 5 hours before slot start
- ⚠️ User can only cancel their own bookings
- ✅ Slot capacity automatically restored
- ✅ Weekly booking count NOT decremented (prevents abuse)

---

### 1.2 Admin Journey: Slot Generation → Management → Overrides

#### **Phase 1: Admin Login**

**Frontend Flow:**
1. Admin visits `/admin/login`
2. Enters email/password
3. Submits `POST /api/auth/login`
4. Backend validates credentials
5. Returns JWT token in JSON response
6. Frontend stores token in sessionStorage (TODO: migrate to httpOnly cookie)

**Backend Processing (`backend/routes/auth.js`):**
- Rate limiting: 5 attempts per 15 minutes
- Validates email/password against `profiles.password_hash`
- Checks role = 'admin' or 'superadmin'
- Generates JWT token (7-day expiry)

**Critical Points:**
- ✅ Rate limiting prevents brute force
- ⚠️ Token stored in sessionStorage (less secure than cookie)
- ✅ Role-based access control enforced

---

#### **Phase 2: Slot Generation**

**Frontend Flow (`src/app/admin/pages/slots/slots.component.ts`):**
1. Admin selects date
2. Clicks "Generate Slots"
3. Frontend checks if slots exist for date
4. If slots exist → Shows confirmation modal for next available date
5. If no slots → Calls `POST /api/slots/generate` with date

**Backend Processing (`backend/routes/slots.js`):**
```
Slot Generation Logic:
1. Parse date (normalize to YYYY-MM-DD)
2. Determine day of week:
   - Monday-Saturday (dayOfWeek 1-6):
     * Generate slots from 7 AM to 9 PM
     * 30-minute intervals
     * Last slot: 8:30 PM - 9:00 PM
   - Sunday (dayOfWeek 0):
     * Morning slots: 10:30 AM, 11:00 AM, 11:30 AM, 12:00 PM, 12:30 PM
     * Evening slots: 3:00 PM to 8:00 PM (30-minute intervals)
3. For each slot time:
   - Check if slot already exists (slot_date, start_time, trainer_id IS NULL)
   - If exists: UPDATE capacity and vehicle capacities
   - If not exists: INSERT new slot
   - Set is_visible based on 24-hour rule
   - Set capacity = 5 (fixed)
   - Set vehicle capacities: electric=3, petrol=1, bike=1
4. Return summary: inserted, updated, skipped counts
```

**Database Changes:**
- `slots` table: INSERT or UPDATE slots for date
- All slots initially have `trainer_id = NULL` (unassigned)
- `is_auto_generated = true`

**Critical Points:**
- ✅ Idempotent: Can be called multiple times safely
- ✅ Updates existing slots to match config (capacity=5)
- ⚠️ Does NOT delete existing slots (only updates)
- ⚠️ Slots created without trainers (admin must assign)

---

#### **Phase 3: Trainer Assignment**

**Frontend Flow:**
1. Admin views slots for date
2. Clicks "Assign Trainer" on slot
3. Selects trainer from dropdown
4. Submits `PUT /api/slots/:id/trainer` with trainer_id

**Backend Processing (`backend/routes/slots.js`):**
- Updates `slots.trainer_id`
- Validates trainer exists and is active
- Broadcasts event: 'slot.assigned'

**Database Changes:**
- `slots` table: UPDATE trainer_id

**Critical Points:**
- ✅ Slots can be unassigned (trainer_id = NULL)
- ⚠️ Unassigned slots are NOT visible to customers
- ✅ Trainer can be changed even if slot has bookings

---

#### **Phase 4: Slot Management & Overrides**

**Admin Actions Available:**
1. **Toggle Enable/Disable:**
   - `PUT /api/slots/:id/toggle`
   - Cannot disable if `booked_count > 0`
   - Toggles between 'available' and 'disabled'

2. **Edit Slot:**
   - `PUT /api/slots/:id`
   - Can update start_time, end_time, capacity, status
   - Cannot reduce capacity below booked_count
   - Checks for duplicate slots before update

3. **Delete Slot:**
   - `DELETE /api/slots/:id`
   - Cannot delete if `booked_count > 0`
   - Cascade deletes bookings (ON DELETE CASCADE)

4. **Update Booking Status:**
   - `PUT /api/admin/bookings/:id/status`
   - Admin can override booking status
   - Valid statuses: pending, confirmed, completed, cancelled, no_show

**Critical Points:**
- ⚠️ Capacity changes require careful validation
- ⚠️ Slot deletion cascades to bookings
- ✅ Admin can override booking statuses

---

### 1.3 Frontend-Backend Communication

#### **Authentication Flow:**
```
Frontend → Backend:
1. Google OAuth: Redirect to /api/auth/google
2. Callback: Backend sets httpOnly cookie
3. Subsequent requests: Cookie sent automatically
4. Fallback: Authorization header (Bearer token)

Backend → Frontend:
1. JWT token in httpOnly cookie (preferred)
2. Token in JSON response (admin login)
3. Error responses: Standardized format with errorCode
```

#### **API Request Patterns:**
```
GET Requests (No body):
- GET /api/slots?date=YYYY-MM-DD
- GET /api/slots/available?date=YYYY-MM-DD
- GET /api/bookings/my-bookings

POST Requests (JSON body):
- POST /api/bookings { slot_id, trainer_id, vehicle_id, phone, notes }
- POST /api/slots/generate { date }

PUT Requests (JSON body):
- PUT /api/bookings/:id/cancel { cancellation_reason }
- PUT /api/slots/:id/trainer { trainer_id }
- PUT /api/slots/:id/toggle { }

DELETE Requests (No body):
- DELETE /api/slots/:id
- DELETE /api/admin/bookings/:id
```

#### **Error Handling:**
```
Backend Error Format:
{
  error: "User-friendly message",
  errorCode: "MACHINE_READABLE_CODE",
  status: 400/401/403/404/500
}

Frontend Error Handling:
- Displays error.error to user
- Logs error.errorCode for debugging
- Handles 401 → Redirects to login
- Handles 403 → Shows access denied
```

---

## 2. BUSINESS RULE VALIDATION

### 2.1 One Slot Per Week, Max Two Bookings

**Rule:** Users can book maximum 1 slot per week (Monday-Sunday), and maximum 2 active bookings total.

**Implementation:**

**Backend Validation (`backend/routes/bookings.js`):**
```javascript
// Weekly limit check
const weeklyBookingsResult = await client.query(
  `SELECT COUNT(*) as count
   FROM bookings
   WHERE user_id = $1
     AND status NOT IN ('cancelled')
     AND created_at >= date_trunc('week', CURRENT_DATE)
     AND created_at < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'`,
  [req.user.id]
);
const weeklyBookingsCount = parseInt(weeklyBookingsResult.rows[0]?.count || 0, 10);
if (weeklyBookingsCount >= WEEKLY_BOOKING_LIMIT) { // WEEKLY_BOOKING_LIMIT = 1
  throw new Error(`Weekly booking limit reached. Maximum allowed: ${WEEKLY_BOOKING_LIMIT}.`);
}

// Total limit check
const totalBookingsResult = await client.query(
  `SELECT COUNT(*) as count
   FROM bookings
   WHERE user_id = $1
     AND status NOT IN ('cancelled')`,
  [req.user.id]
);
const totalBookingsCount = parseInt(totalBookingsResult.rows[0]?.count || 0, 10);
if (totalBookingsCount >= TOTAL_BOOKING_LIMIT) { // TOTAL_BOOKING_LIMIT = 2
  throw new Error(`Total booking limit reached. Maximum allowed: ${TOTAL_BOOKING_LIMIT}.`);
}
```

**Configuration (`backend/config/app.config.js`):**
- `WEEKLY_BOOKING_LIMIT = 1`
- `TOTAL_BOOKING_LIMIT = 2`

**Critical Points:**
- ✅ Weekly limit uses `date_trunc('week', CURRENT_DATE)` (Monday start)
- ✅ Cancelled bookings excluded from count
- ⚠️ Weekly count NOT decremented on cancellation (prevents abuse)
- ⚠️ Counts based on `created_at`, not `slot_date`

**Edge Cases:**
- User books Monday → Cancels Tuesday → Can book again same week? **NO** (count not decremented)
- User has 2 bookings → Cancels 1 → Can book again? **YES** (total count decrements)
- Week boundary: Book Sunday → Cancel Monday → Can book Monday? **YES** (new week)

---

### 2.2 24-Hour Advance Booking Rule

**Rule:** Slots can only be booked if `slot.start_time >= NOW() + 24 hours`.

**Implementation:**

**Backend Validation (`backend/routes/bookings.js`):**
```javascript
const slotCheck = await client.query(
  'SELECT start_time FROM slots WHERE id = $1',
  [slot_id]
);
const slotStartTime = new Date(slotCheck.rows[0].start_time);
const currentTime = new Date();
const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);

if (hoursUntilSlot < BOOKING_ADVANCE_HOURS) { // BOOKING_ADVANCE_HOURS = 24
  throw new Error(`Bookings must be made at least ${BOOKING_ADVANCE_HOURS} hours in advance.`);
}
```

**Slot Visibility (`backend/routes/slots.js`):**
```javascript
// Slots marked as visible based on 24-hour rule
const isVisible = slotStartTime >= new Date(Date.now() + SLOT_VISIBILITY_HOURS * 60 * 60 * 1000);
// SLOT_VISIBILITY_HOURS = 24
```

**Database Function (`supabase/migrations/20250105000000_kolkata_scooty_requirements.sql`):**
```sql
CREATE OR REPLACE FUNCTION is_slot_visible(slot_start_time TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN slot_start_time >= (NOW() + INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;
```

**Frontend Filtering (`src/app/pages/booking/booking.component.ts`):**
```typescript
// Frontend filters out past slots for today
const filtered = (allSlotsForDate || []).filter(s => {
  if (selected.toDateString() === now.toDateString()) {
    const start = new Date(s.start_time);
    return start.getTime() >= now.getTime();
  }
  return true;
});
```

**Critical Points:**
- ✅ Backend enforces rule (cannot bypass)
- ✅ Frontend filters for UX (but backend is source of truth)
- ⚠️ Uses server time (NOW()) for consistency
- ⚠️ Exact 24 hours: Slot at 2:00 PM can be booked at 2:00 PM previous day

**Edge Cases:**
- User tries to book at 11:59 PM for slot at 11:59 PM next day → **ALLOWED** (exactly 24 hours)
- User tries to book at 12:00 AM for slot at 11:59 PM same day → **DENIED** (< 24 hours)
- Timezone differences: Backend uses server timezone (UTC recommended)

---

### 2.3 3-Hour Cancellation Cutoff (Actually 5 Hours)

**Rule:** Bookings can only be cancelled if `slot.start_time - NOW() > 5 hours`.

**Note:** Configuration shows `CANCELLATION_DEADLINE_HOURS = 3`, but actual implementation uses 5 hours.

**Implementation:**

**Backend Validation (`backend/routes/bookings.js`):**
```javascript
// Database function check
const cancellationCheck = await client.query(
  'SELECT can_cancel_booking($1) as can_cancel',
  [req.params.id]
);
if (!cancellationCheck.rows[0]?.can_cancel) {
  throw new Error(config.booking.cancellationWindowMessage);
}

// Manual check (defense in depth)
const slotCheck = await client.query(
  'SELECT start_time FROM slots WHERE id = $1',
  [booking.slot_id]
);
const slotStartTime = new Date(slotCheck.rows[0].start_time);
const hoursUntilSlot = (slotStartTime - new Date()) / (1000 * 60 * 60);

if (hoursUntilSlot <= CANCELLATION_DEADLINE_HOURS) { // Actually uses 5 hours
  throw new Error(config.booking.cancellationWindowMessage);
}
```

**Database Function (`supabase/migrations/20250105000000_kolkata_scooty_requirements.sql`):**
```sql
CREATE OR REPLACE FUNCTION can_cancel_booking(booking_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  slot_start_time TIMESTAMPTZ;
  hours_until_slot NUMERIC;
BEGIN
  SELECT s.start_time INTO slot_start_time
  FROM bookings b
  JOIN slots s ON b.slot_id = s.id
  WHERE b.id = booking_id_param;
  
  hours_until_slot := EXTRACT(EPOCH FROM (slot_start_time - NOW())) / 3600;
  
  -- Can cancel if more than 5 hours before slot
  RETURN hours_until_slot > 5;
END;
$$ LANGUAGE plpgsql;
```

**Configuration (`backend/app.config.js`):**
```javascript
cancellationWindowHours: 5,
cancellationWindowMessage: 'Cancellation is only allowed up to 5 hours before the class start time'
```

**Critical Points:**
- ⚠️ **DISCREPANCY:** Config file shows `CANCELLATION_DEADLINE_HOURS = 3`, but actual rule is 5 hours
- ✅ Database function uses 5 hours (source of truth)
- ✅ Double validation (function + manual check)
- ⚠️ Exact 5 hours: Slot at 2:00 PM can be cancelled until 9:00 AM same day

**Edge Cases:**
- User tries to cancel at 8:59 AM for slot at 2:00 PM → **ALLOWED** (> 5 hours)
- User tries to cancel at 9:00 AM for slot at 2:00 PM → **DENIED** (exactly 5 hours)
- User tries to cancel at 9:01 AM for slot at 2:00 PM → **DENIED** (< 5 hours)

---

### 2.4 Slot Capacity Handling

**Rule:** Each slot has fixed capacity of 5 trainees. Vehicle breakdown: Electric=3, Petrol=1, Bike=1.

**Implementation:**

**Database Constraints (`supabase/migrations/20260116000100_enforce_slot_schema.sql`):**
```sql
-- Capacity must be exactly 5
ALTER TABLE slots ADD CONSTRAINT slots_capacity_check 
  CHECK (capacity = 5);

-- Vehicle capacities must sum to 5
ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
  CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);

-- Booked count cannot exceed capacity
ALTER TABLE slots ADD CONSTRAINT slots_booked_count_check 
  CHECK (booked_count >= 0 AND booked_count <= capacity);
```

**Backend Validation (`backend/routes/bookings.js`):**
```javascript
// Atomic booking with capacity check
const bookingResult = await client.query(
  `WITH locked_slot AS (
    SELECT s.* FROM slots s WHERE s.id = $1 FOR UPDATE
  ),
  slot_validation AS (
    SELECT 
      ls.*,
      CASE 
        WHEN ls.booked_count >= ls.capacity THEN 'SLOT_FULL'
        ELSE 'VALID'
      END as validation_status
    FROM locked_slot ls
  ),
  booking_insert AS (
    INSERT INTO bookings (user_id, slot_id, trainer_id, vehicle_id, status, notes)
    SELECT $2, $1, $3, $4, $6, $5
    FROM slot_validation
    WHERE validation_status = 'VALID'
      AND booked_count < capacity
    RETURNING *
  ),
  slot_update AS (
    UPDATE slots
    SET booked_count = booked_count + 1,
        status = CASE 
          WHEN slots.booked_count + 1 >= slots.capacity THEN 'full'
          ELSE slots.status
        END
    FROM booking_insert
    WHERE slots.id = $1
      AND EXISTS (SELECT 1 FROM booking_insert)
    RETURNING slots.*
  )
  SELECT ... FROM booking_insert ...`,
  [slot_id, req.user.id, trainer_id, vehicle_id, notes, config.booking.defaultStatus]
);
```

**Critical Points:**
- ✅ Capacity fixed at 5 (database constraint)
- ✅ Vehicle capacities sum to 5 (database constraint)
- ✅ Row-level locking prevents overbooking
- ✅ Status automatically updates to 'full' when capacity reached
- ⚠️ Vehicle-specific capacity not enforced (only total capacity)

**Edge Cases:**
- 5 users book electric scooty → **ALLOWED** (only total capacity checked)
- Admin reduces capacity to 3 while 4 bookings exist → **PREVENTED** (constraint)
- Race condition: 2 users book simultaneously → **PREVENTED** (FOR UPDATE lock)

---

### 2.5 Admin Approval Workflow

**Rule:** Users must have approved student recognition before booking. Admin must approve recognition submissions.

**Implementation:**

**Backend Validation (`backend/routes/bookings.js`):**
```javascript
// Check student recognition status FIRST
const studentRecognitionCheck = await client.query(
  `SELECT status FROM student_recognition 
   WHERE user_id = $1 
   ORDER BY created_at DESC 
   LIMIT 1`,
  [req.user.id]
);

if (studentRecognitionCheck.rows.length === 0) {
  throw new Error('Student recognition not found. Please submit your invoice for verification before making bookings.');
}

const recognitionStatus = studentRecognitionCheck.rows[0].status;
if (recognitionStatus !== 'approved') {
  throw new Error(`Your student recognition status is "${recognitionStatus}". Only approved students can make bookings.`);
}
```

**Admin Approval (`backend/routes/recognition.js`):**
```javascript
// Admin approves recognition
router.put('/:id/approve', authenticate, authorize('admin', 'superadmin'), async (req, res, next) => {
  // Update status to approved
  await client.query(
    `UPDATE student_recognition 
     SET status = 'approved',
         approved_at = NOW()
     WHERE id = $1`,
    [id]
  );
});
```

**Critical Points:**
- ✅ Recognition check happens FIRST (before any booking logic)
- ✅ Only 'approved' status allows bookings
- ✅ Admin-only approval endpoint
- ⚠️ User can resubmit if rejected/pending
- ⚠️ Only one approved recognition per user

**Edge Cases:**
- User submits recognition → Admin approves → User can book → **ALLOWED**
- User submits recognition → Status pending → User tries to book → **DENIED**
- User has rejected recognition → Resubmits → Admin approves → **ALLOWED**

---

### 2.6 User Ownership and Access Control

**Rule:** Users can only access/modify their own bookings. Admins can access all.

**Implementation:**

**Backend Middleware (`backend/middleware/auth.js`):**
```javascript
const authenticate = async (req, res, next) => {
  // Get token from cookie or header
  let token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
  
  // Verify JWT
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // Load user from database
  const result = await db.query(
    'SELECT * FROM profiles WHERE id = $1',
    [decoded.userId]
  );
  
  req.user = result.rows[0];
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new Error('Insufficient permissions');
    }
    next();
  };
};
```

**Booking Ownership Check (`backend/routes/bookings.js`):**
```javascript
// Cancel booking - verify ownership
const bookingResult = await client.query(
  'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
  [req.params.id, req.user.id]
);

if (bookingResult.rows.length === 0) {
  // Check if booking exists but belongs to different user
  const bookingExistsCheck = await client.query(
    'SELECT id FROM bookings WHERE id = $1',
    [req.params.id]
  );
  
  if (bookingExistsCheck.rows.length > 0) {
    const error = new Error('Access denied. This booking does not belong to you.');
    error.status = 403;
    throw error;
  }
  
  throw new Error('Booking not found');
}
```

**Database RLS Policies (`supabase/migrations/20251102124908_init_schema.sql`):**
```sql
-- Users can view their own bookings
CREATE POLICY "View bookings policy" ON bookings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Users can create their own bookings
CREATE POLICY "Create bookings policy" ON bookings FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Users can update their own bookings
CREATE POLICY "Update bookings policy" ON bookings FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
```

**Critical Points:**
- ✅ JWT-based authentication
- ✅ Role-based authorization (admin, superadmin)
- ✅ Ownership checks in application code
- ✅ Database RLS policies (defense in depth)
- ⚠️ RLS uses `auth.uid()` (Supabase auth) but app uses JWT (may need adjustment)

**Edge Cases:**
- User A tries to cancel User B's booking → **DENIED** (403 Forbidden)
- Admin tries to cancel any booking → **ALLOWED**
- User with expired token → **DENIED** (401 Unauthorized)

---

## 3. SLOT GENERATION LOGIC

### 3.1 How Slots Are Generated Per Date

**Endpoint:** `POST /api/slots/generate`

**Algorithm:**

**Step 1: Date Normalization**
```javascript
const dateString = (date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10));
const targetDate = new Date(dateString + 'T00:00:00');
const dayOfWeek = targetDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
```

**Step 2: Weekday Generation (Monday-Saturday)**
```javascript
if (dayOfWeek >= 1 && dayOfWeek <= 6) {
  const weekdayConfig = config.slot.generation.weekday;
  // startHour: 7 (7 AM)
  // endHour: 21 (9 PM)
  // intervalMinutes: 30
  
  let currentTime = new Date(targetDate);
  currentTime.setHours(weekdayConfig.startHour, 0, 0, 0);
  const endTime = new Date(targetDate);
  endTime.setHours(weekdayConfig.endHour, 0, 0, 0);
  
  while (currentTime < endTime) {
    const slotStart = new Date(currentTime);
    currentTime.setMinutes(currentTime.getMinutes() + weekdayConfig.intervalMinutes);
    const slotEnd = new Date(currentTime);
    
    // Create slot: 7:00-7:30, 7:30-8:00, ..., 8:30-9:00
  }
}
```

**Step 3: Sunday Generation**
```javascript
if (dayOfWeek === 0) {
  const sundayConfig = config.slot.generation.sunday;
  
  // Morning slots: Exact times
  for (const time of sundayConfig.morning) {
    // 10:30 AM, 11:00 AM, 11:30 AM, 12:00 PM, 12:30 PM
  }
  
  // Evening slots: 3:00 PM to 8:00 PM (30-minute intervals)
  let eveningTime = new Date(targetDate);
  eveningTime.setHours(sundayConfig.evening.startHour, 0, 0, 0);
  // Generate: 3:00-3:30, 3:30-4:00, ..., 8:00-8:30
}
```

**Step 4: Slot Insertion**
```javascript
for (const slot of slots) {
  // Check if slot exists
  const existing = await db.query(`
    SELECT id, capacity FROM slots 
    WHERE slot_date = $1 
      AND start_time = $2 
      AND trainer_id IS NULL
  `, [slot.slot_date, slot.start_time]);
  
  if (existing.rows.length > 0) {
    // Update existing slot
    await db.query(`
      UPDATE slots 
      SET capacity = 5, 
          is_visible = $1, 
          electric_capacity = 3,
          petrol_capacity = 1,
          bike_capacity = 1,
          updated_at = NOW()
      WHERE id = $2
    `, [slot.is_visible, existing.rows[0].id]);
    updatedCount++;
  } else {
    // Insert new slot
    await db.query(`
      INSERT INTO slots (trainer_id, start_time, end_time, capacity, booked_count, status, slot_date, is_auto_generated, is_visible, electric_capacity, petrol_capacity, bike_capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [null, slot.start_time, slot.end_time, 5, 0, 'available', slot.slot_date, true, slot.is_visible, 3, 1, 1]);
    insertedCount++;
  }
}
```

**Critical Points:**
- ✅ Idempotent: Can be called multiple times safely
- ✅ Updates existing slots to match config
- ✅ Does NOT delete slots (only inserts/updates)
- ✅ Sets `is_visible` based on 24-hour rule
- ⚠️ All slots created without trainers (admin must assign)

---

### 3.2 What Happens If Slots Already Exist

**Scenario 1: Slots Exist for Date**
- Frontend checks: `GET /api/slots?date=YYYY-MM-DD`
- If slots found → Shows confirmation modal
- Admin can choose to generate for next available date
- Or proceed anyway (slots will be updated)

**Scenario 2: Partial Slots Exist**
- Some slots exist, some don't
- Generation process:
  - Existing slots: Updated (capacity, vehicle capacities)
  - Missing slots: Inserted
- Result: Complete set of slots for date

**Scenario 3: Slots Exist with Bookings**
- Existing slots with `booked_count > 0` are NOT deleted
- Slots are updated (capacity, visibility)
- Bookings remain intact
- ⚠️ **RISK:** If capacity changes, overbooking possible (but constraint prevents this)

**Critical Points:**
- ✅ Idempotent operation
- ⚠️ Does NOT delete slots (even if config changes)
- ⚠️ Updates may change slot properties (capacity, visibility)
- ✅ Bookings preserved

---

### 3.3 Date Navigation Logic (Previous/Next Day)

**Frontend Implementation (`src/app/admin/pages/slots/slots.component.ts`):**
```typescript
navigateDate(days: number) {
  // Parse current date as UTC
  const currentDateStr = this.normalizeDate(this.selectedDate);
  const [year, month, day] = currentDateStr.split('-').map(Number);
  
  // Create UTC date at midnight
  const currentDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  // Add/subtract days in UTC
  currentDate.setUTCDate(currentDate.getUTCDate() + days);
  
  // Convert back to YYYY-MM-DD using UTC components
  this.selectedDate = this.normalizeToUTCDate(currentDate);
  this.onSelectedDateChange();
}
```

**User Booking Component (`src/app/pages/booking/booking.component.ts`):**
```typescript
changeDate(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedDate = this.normalizeDate(this.selectedDate);
  const current = new Date(normalizedDate + 'T00:00:00');
  current.setDate(current.getDate() + days);
  current.setHours(0, 0, 0, 0);
  
  // Prevent navigating to past dates
  if (current < today) {
    this.selectedDate = this.normalizeDate(today.toISOString().split('T')[0]);
  } else {
    this.selectedDate = this.normalizeDate(current.toISOString().split('T')[0]);
  }
  this.onDateChange();
}
```

**Critical Points:**
- ✅ Admin can navigate to past dates (for viewing)
- ✅ Users cannot navigate to past dates (prevented)
- ✅ UTC normalization prevents timezone issues
- ⚠️ Date parsing uses local timezone (potential issue)

---

### 3.4 Timezone Handling Risks

**Current Implementation:**

**Backend (`backend/routes/slots.js`):**
```javascript
// Uses server timezone (likely UTC)
const targetDate = new Date(dateString + 'T00:00:00');
const dayOfWeek = targetDate.getDay();
```

**Frontend (`src/app/admin/pages/slots/slots.component.ts`):**
```typescript
// Uses UTC normalization
normalizeToUTCDate(date: Date | string): string {
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Database:**
- Stores `TIMESTAMPTZ` (timezone-aware)
- Uses `NOW()` (server timezone)

**Risks Identified:**

1. **Date Boundary Issues:**
   - User in timezone UTC+5:30 selects "2026-01-20"
   - Server interprets as UTC midnight
   - User expects local midnight
   - **RISK:** Slots may appear on wrong date

2. **Slot Visibility Calculation:**
   - `is_visible = slotStartTime >= (NOW() + INTERVAL '24 hours')`
   - Uses server timezone
   - **RISK:** User in different timezone may see/hide slots incorrectly

3. **Weekly Booking Limit:**
   - Uses `date_trunc('week', CURRENT_DATE)`
   - Server timezone determines week boundary
   - **RISK:** User's local week may differ from server week

**Recommendations:**
- ✅ Use UTC consistently across all date operations
- ✅ Store all timestamps as UTC in database
- ✅ Convert to user timezone only for display
- ⚠️ Consider storing user timezone preference
- ⚠️ Add timezone validation in date inputs

---

## 4. FAILURE & FALLBACK SCENARIOS

### 4.1 API Failure Scenarios

#### **Scenario 1: Backend Server Down**

**Symptoms:**
- Frontend requests timeout
- 500 Internal Server Error
- Network errors

**Frontend Handling (`src/app/services/http.service.ts`):**
```typescript
// Error handling in HTTP service
catch (error) {
  if (error.status === 0) {
    // Network error
    this.toastService.error('Network error. Please check your connection.');
  } else if (error.status >= 500) {
    // Server error
    this.toastService.error('Server error. Please try again later.');
  }
  throw error;
}
```

**Fallback Strategy:**
- ✅ Show user-friendly error message
- ✅ Retry button available
- ⚠️ No offline mode (bookings lost if server down)
- ⚠️ No queue for failed requests

**Recommendations:**
- Implement request queue for failed bookings
- Add retry logic with exponential backoff
- Consider service worker for offline support

---

#### **Scenario 2: Database Connection Lost**

**Symptoms:**
- Backend returns 500 error
- Database connection pool exhausted
- Query timeouts

**Backend Handling (`backend/db.js`):**
```javascript
// Connection pool management
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Fallback Strategy:**
- ✅ Connection pooling prevents exhaustion
- ✅ Automatic retry on connection loss
- ⚠️ No graceful degradation
- ⚠️ Transactions may be lost

**Recommendations:**
- Implement database health checks
- Add circuit breaker pattern
- Log connection errors for monitoring

---

#### **Scenario 3: Partial API Failure (Some Endpoints Work)**

**Symptoms:**
- Slots load but bookings fail
- Authentication works but data endpoints fail
- Intermittent errors

**Frontend Handling:**
- ✅ Each API call handled independently
- ✅ Errors shown per operation
- ⚠️ No global error state
- ⚠️ User may see inconsistent UI

**Recommendations:**
- Implement global error boundary
- Add health check endpoint
- Show system status to users

---

### 4.2 Duplicate Slot Generation

**Scenario:** Admin clicks "Generate Slots" multiple times rapidly.

**Current Protection:**
```javascript
// Check if slot exists before insert
const existing = await db.query(`
  SELECT id FROM slots 
  WHERE slot_date = $1 
    AND start_time = $2 
    AND trainer_id IS NULL
`, [slot.slot_date, slot.start_time]);

if (existing.rows.length > 0) {
  // Update instead of insert
  updatedCount++;
} else {
  // Insert new slot
  insertedCount++;
}
```

**Database Protection:**
```sql
-- Unique constraint prevents duplicates
CREATE UNIQUE INDEX idx_slots_unique_unassigned
  ON slots(start_time, end_time)
  WHERE trainer_id IS NULL;

CREATE UNIQUE INDEX idx_slots_unique_assigned
  ON slots(trainer_id, start_time, end_time)
  WHERE trainer_id IS NOT NULL;
```

**Critical Points:**
- ✅ Idempotent operation (safe to call multiple times)
- ✅ Database constraint prevents duplicates
- ✅ Updates existing slots instead of creating duplicates
- ⚠️ Race condition possible if called simultaneously (but constraint prevents)

**Edge Case:**
- Two admins generate slots for same date simultaneously → **SAFE** (constraint prevents duplicates)

---

### 4.3 Partial Slot Creation

**Scenario:** Slot generation fails partway through (e.g., database error after creating 10 slots).

**Current Behavior:**
```javascript
for (const slot of slots) {
  try {
    // Insert or update slot
    if (existing.rows.length > 0) {
      await db.query(`UPDATE slots ...`);
    } else {
      await db.query(`INSERT INTO slots ...`);
    }
  } catch (error) {
    // If duplicate key error, skip it
    if (error.code === '23505' || error.message.includes('duplicate key')) {
      skippedCount++;
      continue;
    }
    throw error; // Re-throw other errors
  }
}
```

**Critical Points:**
- ⚠️ **NO TRANSACTION:** Each slot inserted individually
- ⚠️ **PARTIAL FAILURE:** Some slots created, some not
- ⚠️ **NO ROLLBACK:** Cannot undo partial creation
- ✅ Error thrown stops further processing

**Recommendations:**
- Wrap entire generation in transaction
- Implement rollback on failure
- Add "retry failed slots" functionality

---

### 4.4 Booking Race Conditions

**Scenario:** Two users try to book the last available slot simultaneously.

**Current Protection:**
```javascript
// Atomic booking with row-level lock
const bookingResult = await client.query(
  `WITH locked_slot AS (
    SELECT s.* FROM slots s WHERE s.id = $1 FOR UPDATE
  ),
  slot_validation AS (
    SELECT 
      ls.*,
      CASE 
        WHEN ls.booked_count >= ls.capacity THEN 'SLOT_FULL'
        ELSE 'VALID'
      END as validation_status
    FROM locked_slot ls
  ),
  booking_insert AS (
    INSERT INTO bookings ...
    FROM slot_validation
    WHERE validation_status = 'VALID'
      AND booked_count < capacity
    RETURNING *
  ),
  slot_update AS (
    UPDATE slots SET booked_count = booked_count + 1 ...
    FROM booking_insert
    WHERE EXISTS (SELECT 1 FROM booking_insert)
    RETURNING slots.*
  )
  SELECT ...`,
  [slot_id, req.user.id, trainer_id, vehicle_id, notes]
);
```

**Critical Points:**
- ✅ **ROW-LEVEL LOCK:** `FOR UPDATE` prevents concurrent access
- ✅ **ATOMIC OPERATION:** Booking and slot update in single query
- ✅ **VALIDATION IN QUERY:** Checks capacity before insert
- ✅ **TRANSACTION:** All-or-nothing operation

**Edge Cases:**
- User A and User B both see slot as available → Both submit → **ONE SUCCEEDS, ONE FAILS** (lock prevents both)
- User A books → User B tries to book same slot → **DENIED** (slot.full or booked_count >= capacity)

**Recommendations:**
- ✅ Current implementation is robust
- Consider adding optimistic locking (version field)
- Add retry logic for failed bookings

---

### 4.5 Invalid Date Navigation

**Scenario:** User tries to navigate to invalid dates (past, far future, invalid format).

**Frontend Protection (`src/app/pages/booking/booking.component.ts`):**
```typescript
changeDate(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = new Date(normalizedDate + 'T00:00:00');
  current.setDate(current.getDate() + days);
  
  // Prevent navigating to past dates
  if (current < today) {
    this.selectedDate = this.normalizeDate(today.toISOString().split('T')[0]);
  } else {
    this.selectedDate = this.normalizeDate(current.toISOString().split('T')[0]);
  }
}

isPrevDisabled(): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(this.selectedDate);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() <= today.getTime();
}
```

**Backend Protection (`backend/routes/slots.js`):**
```javascript
// Date validation in slot generation
const dateString = (date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10));
const targetDate = new Date(dateString + 'T00:00:00');

if (isNaN(targetDate.getTime())) {
  throw new Error('Invalid date format');
}
```

**Critical Points:**
- ✅ Frontend prevents past date navigation
- ✅ Backend validates date format
- ⚠️ No maximum future date limit
- ⚠️ Invalid date strings may cause errors

**Edge Cases:**
- User manually edits date input to "2020-01-01" → **PREVENTED** (min date attribute)
- User navigates to "2099-12-31" → **ALLOWED** (no max limit)
- User enters "invalid-date" → **HANDLED** (normalizeDate fallback)

---

### 4.6 Unauthorized Access Attempts

**Scenario:** User tries to access admin endpoints or other users' data.

**Backend Protection (`backend/middleware/auth.js`):**
```javascript
const authenticate = async (req, res, next) => {
  // Verify JWT token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // Load user
  req.user = result.rows[0];
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new Error('Insufficient permissions');
    }
    next();
  };
};
```

**Route Protection:**
```javascript
// Admin routes
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

// User routes
router.post('/', authenticate, validateBookingCreation, async (req, res, next) => {
  // User can only create their own bookings
  // user_id comes from req.user.id (from JWT)
});
```

**Database RLS (`supabase/migrations/20251102124908_init_schema.sql`):**
```sql
-- Users can only view their own bookings
CREATE POLICY "View bookings policy" ON bookings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);
```

**Critical Points:**
- ✅ JWT verification required
- ✅ Role-based authorization
- ✅ Ownership checks in application code
- ⚠️ RLS uses `auth.uid()` but app uses JWT (may need adjustment)
- ✅ 401/403 errors returned appropriately

**Edge Cases:**
- User with expired token → **401 Unauthorized**
- Customer tries to access admin endpoint → **403 Forbidden**
- User A tries to cancel User B's booking → **403 Forbidden**
- Malformed JWT token → **401 Unauthorized**

---

## 5. EDGE CASES

### 5.1 Double Booking Attempts

**Scenario:** User tries to book the same slot twice.

**Current Protection:**
```javascript
// Check for existing booking
const existingBooking = await client.query(
  `SELECT * FROM bookings 
   WHERE user_id = $1 
     AND slot_id = $2 
     AND status NOT IN ('cancelled')`,
  [req.user.id, slot_id]
);

if (existingBooking.rows.length > 0) {
  throw new Error('You already have a booking for this slot');
}
```

**Critical Points:**
- ✅ Check happens before transaction
- ✅ Cancelled bookings excluded
- ⚠️ Race condition possible if user clicks twice rapidly

**Recommendation:**
- Add unique constraint: `(user_id, slot_id)` where status != 'cancelled'
- Add frontend debouncing on booking button

---

### 5.2 Booking Exactly at Cutoff Time

**Scenario:** User tries to book at exactly 24 hours before slot (e.g., slot at 2:00 PM, user books at 2:00 PM previous day).

**Current Logic:**
```javascript
const hoursUntilSlot = (slotStartTime - currentTime) / (1000 * 60 * 60);

if (hoursUntilSlot < BOOKING_ADVANCE_HOURS) { // 24 hours
  throw new Error('Bookings must be made at least 24 hours in advance.');
}
```

**Critical Points:**
- ⚠️ Uses `<` (strict less than) → Exactly 24 hours = **ALLOWED**
- ⚠️ Millisecond precision may cause edge cases
- ⚠️ Server time vs client time differences

**Edge Cases:**
- User books at 2:00:00.000 PM for slot at 2:00:00.001 PM next day → **ALLOWED** (>= 24 hours)
- User books at 2:00:00.001 PM for slot at 2:00:00.000 PM next day → **DENIED** (< 24 hours)

**Recommendation:**
- Use `<=` for strict 24-hour requirement
- Add buffer (e.g., 24 hours + 1 minute) for safety

---

### 5.3 Deleting Trainers with Active Slots

**Scenario:** Admin tries to delete trainer who has assigned slots.

**Current Protection (`backend/routes/admin.js`):**
```javascript
router.delete('/trainers/:id', async (req, res, next) => {
  const bookingsCheck = await db.query(
    'SELECT COUNT(*) as count FROM bookings WHERE trainer_id = $1',
    [id]
  );

  if (parseInt(bookingsCheck.rows[0].count) > 0) {
    throw new Error('Cannot delete trainer with existing bookings.');
  }

  const result = await db.query('DELETE FROM trainers WHERE id = $1 RETURNING *', [id]);
});
```

**Database Constraints (`supabase/migrations/20251102124908_init_schema.sql`):**
```sql
CREATE TABLE slots (
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  ...
);
```

**Critical Points:**
- ✅ Application checks for bookings before deletion
- ✅ Database sets `trainer_id = NULL` on trainer deletion (cascade)
- ⚠️ Slots become unassigned (may break user experience)
- ⚠️ No check for future slots (only bookings)

**Edge Cases:**
- Trainer has slots but no bookings → **ALLOWED** (slots become unassigned)
- Trainer has future bookings → **DENIED** (application check)
- Trainer deleted → Slots become unassigned → **USERS CANNOT BOOK** (slots need trainer)

**Recommendation:**
- Check for future slots before deletion
- Reassign slots to another trainer
- Or prevent deletion if slots exist

---

### 5.4 Changing Capacity After Bookings Exist

**Scenario:** Admin tries to reduce slot capacity when bookings already exist.

**Current Protection (`backend/routes/slots.js`):**
```javascript
if (capacity !== undefined) {
  const finalCapacity = Math.min(capacity, SLOT_CAPACITY.MAX);
  
  // Check current booked_count
  const currentSlot = await db.query(
    'SELECT booked_count FROM slots WHERE id = $1', 
    [req.params.id]
  );
  
  if (currentSlot.rows.length > 0 && currentSlot.rows[0].booked_count > finalCapacity) {
    throw new Error(`Cannot reduce capacity below current bookings (${currentSlot.rows[0].booked_count} bookings exist)`);
  }
}
```

**Database Constraint:**
```sql
ALTER TABLE slots ADD CONSTRAINT slots_booked_count_check 
  CHECK (booked_count >= 0 AND booked_count <= capacity);
```

**Critical Points:**
- ✅ Application checks before update
- ✅ Database constraint prevents invalid state
- ✅ Can increase capacity (no restriction)
- ⚠️ Capacity fixed at 5 (cannot be changed)

**Edge Cases:**
- Admin tries to set capacity to 3 when 4 bookings exist → **DENIED**
- Admin tries to set capacity to 6 → **CLAMPED TO 5** (MAX)
- Admin tries to set capacity to 5 when 5 bookings exist → **ALLOWED** (no change)

---

### 5.5 Daylight Saving / Timezone Offsets

**Scenario:** System handles DST transitions and timezone differences.

**Current Implementation:**
- Uses `TIMESTAMPTZ` (timezone-aware timestamps)
- Uses `NOW()` (server timezone)
- Frontend uses UTC normalization

**Risks:**

1. **DST Transition:**
   - Spring forward: 2:00 AM → 3:00 AM (1 hour lost)
   - Fall back: 2:00 AM → 1:00 AM (1 hour gained)
   - **RISK:** Slot times may shift or duplicate

2. **Timezone Differences:**
   - Server in UTC, users in IST (UTC+5:30)
   - **RISK:** Date boundaries may differ

3. **Weekly Limit Calculation:**
   - Uses `date_trunc('week', CURRENT_DATE)`
   - Server timezone determines week start
   - **RISK:** User's local week may differ

**Recommendations:**
- ✅ Use UTC consistently (current approach)
- ✅ Store all timestamps as UTC
- ⚠️ Convert to user timezone only for display
- ⚠️ Add timezone validation
- ⚠️ Test DST transitions

---

## 6. DATA CONSISTENCY CHECKS

### 6.1 Backend vs Frontend State Mismatch

**Scenario:** Frontend shows stale data (e.g., slot appears available but is actually full).

**Current Mechanisms:**

**1. Real-time Updates (SSE):**
```typescript
// Frontend subscribes to slot events
subscribeToSlotEvents() {
  const url = `${environment.apiUrl}/events`;
  this.slotEvents = new EventSource(url);
  this.slotEvents.onmessage = async (ev) => {
    const payload = JSON.parse(ev.data || '{}');
    if (payload.event?.startsWith('slot.')) {
      await this.loadSlots(); // Reload on change
    }
  };
}
```

**2. Polling:**
```typescript
// Auto-refresh every 10 seconds
startAutoRefresh() {
  this.refreshInterval = setInterval(() => {
    this.loadSlots();
  }, 10000);
}
```

**3. Backend Validation:**
```javascript
// Backend always validates current state
const bookingResult = await client.query(
  `WITH locked_slot AS (
    SELECT s.* FROM slots s WHERE s.id = $1 FOR UPDATE
  ),
  slot_validation AS (
    SELECT 
      CASE 
        WHEN ls.booked_count >= ls.capacity THEN 'SLOT_FULL'
        ELSE 'VALID'
      END as validation_status
    FROM locked_slot ls
  ),
  ...
`);
```

**Critical Points:**
- ✅ Backend is source of truth (always validates)
- ✅ Frontend refreshes periodically
- ✅ SSE provides real-time updates
- ⚠️ Race condition: User sees available → Another user books → User tries to book → **DENIED** (backend prevents)

**Recommendations:**
- ✅ Current approach is robust
- Consider optimistic UI updates
- Show "Slot just booked" message on failure

---

### 6.2 Stale UI Data

**Scenario:** User keeps page open for hours, sees outdated slot availability.

**Current Protection:**
- Auto-refresh every 10 seconds
- SSE events trigger refresh
- Manual refresh button

**Critical Points:**
- ✅ Auto-refresh prevents stale data
- ⚠️ 10-second delay may cause issues
- ⚠️ SSE may fail silently

**Recommendations:**
- Reduce refresh interval to 5 seconds
- Add SSE reconnection logic
- Show "Data may be outdated" warning after 1 minute

---

### 6.3 Pagination Inconsistencies

**Scenario:** Admin views bookings page 2, user cancels booking, page shows wrong data.

**Current Implementation (`src/app/admin/pages/bookings/bookings.component.ts`):**
```typescript
getPaginatedBookings() {
  const start = (this.currentPage - 1) * this.itemsPerPage;
  const end = start + this.itemsPerPage;
  return this.filteredBookings.slice(start, end);
}
```

**Critical Points:**
- ⚠️ Pagination done client-side (all data loaded)
- ⚠️ No server-side pagination
- ⚠️ Cancellation may change page contents

**Edge Cases:**
- Admin on page 2 (bookings 11-20) → User cancels booking #15 → **BOOKING DISAPPEARS FROM PAGE**
- Admin filters by status → User changes status → **FILTER MAY HIDE BOOKING**

**Recommendations:**
- Implement server-side pagination
- Add refresh on status change
- Show notification when data changes

---

### 6.4 Filtering + Pagination Combined Behavior

**Scenario:** Admin filters bookings, then navigates pages, filter resets.

**Current Implementation:**
```typescript
applyFilters() {
  let filtered = [...this.bookings];
  
  // Apply search filter
  if (this.searchTerm) {
    filtered = filtered.filter(booking => {
      // Search logic
    });
  }
  
  // Apply status filter
  if (this.statusFilter) {
    filtered = filtered.filter(booking => booking.status === this.statusFilter);
  }
  
  // Apply date filter
  if (this.startDateFilter && this.endDateFilter) {
    filtered = filtered.filter(booking => {
      // Date logic
    });
  }
  
  this.filteredBookings = filtered;
  this.currentPage = 1; // Reset to first page
}

getPaginatedBookings() {
  const start = (this.currentPage - 1) * this.itemsPerPage;
  const end = start + this.itemsPerPage;
  return this.filteredBookings.slice(start, end);
}
```

**Critical Points:**
- ✅ Filters reset page to 1 (good UX)
- ✅ Pagination works on filtered results
- ⚠️ All filtering done client-side (performance issue with large datasets)

**Recommendations:**
- Implement server-side filtering
- Add loading states
- Show filter summary (e.g., "Showing 15 of 150 bookings")

---

## 7. ENHANCEMENT-SAFE STRATEGY

### 7.1 How Future Features Can Be Added Without Breaking Existing Bookings

#### **Principle 1: Backward Compatibility**

**Database Schema Changes:**
- ✅ Use `ALTER TABLE ADD COLUMN` with defaults
- ✅ Use `ALTER TABLE ALTER COLUMN SET DEFAULT` for new columns
- ✅ Never drop columns (mark as deprecated instead)
- ✅ Use migrations for all schema changes

**API Changes:**
- ✅ Add new optional fields to requests
- ✅ Never remove required fields (mark as deprecated)
- ✅ Version API endpoints (`/api/v1/`, `/api/v2/`)
- ✅ Support multiple API versions during transition

**Example:**
```javascript
// Adding new field "preferred_vehicle_type"
// OLD: { slot_id, trainer_id, vehicle_id }
// NEW: { slot_id, trainer_id, vehicle_id, preferred_vehicle_type? }

// Backend handles both:
const preferredVehicleType = req.body.preferred_vehicle_type || null;
// Existing bookings unaffected
```

---

#### **Principle 2: Feature Flags**

**Implementation:**
```javascript
// Feature flag system
const FEATURES = {
  MULTI_VEHICLE_BOOKING: process.env.FEATURE_MULTI_VEHICLE === 'true',
  ADVANCED_CANCELLATION: process.env.FEATURE_ADVANCED_CANCELLATION === 'true',
};

// Use in code
if (FEATURES.MULTI_VEHICLE_BOOKING) {
  // New feature logic
} else {
  // Existing logic
}
```

**Benefits:**
- ✅ Gradual rollout
- ✅ Easy rollback
- ✅ A/B testing
- ✅ No impact on existing users

---

#### **Principle 3: Database Migrations**

**Best Practices:**
1. **Always use migrations** (never manual SQL)
2. **Test migrations on staging** first
3. **Make migrations reversible** (provide down migration)
4. **Add columns as nullable** initially, then make required later
5. **Use transactions** for data migrations

**Example:**
```sql
-- Migration: Add cancellation_reason to bookings
-- Step 1: Add nullable column
ALTER TABLE bookings ADD COLUMN cancellation_reason TEXT;

-- Step 2: Backfill existing data (if needed)
UPDATE bookings SET cancellation_reason = 'N/A' WHERE status = 'cancelled' AND cancellation_reason IS NULL;

-- Step 3: Make required (in separate migration after deployment)
-- ALTER TABLE bookings ALTER COLUMN cancellation_reason SET NOT NULL;
```

---

#### **Principle 4: API Versioning**

**Strategy:**
```
/api/v1/bookings  → Current version (stable)
/api/v2/bookings  → New version (with enhancements)
```

**Implementation:**
```javascript
// Version 1 (existing)
router.post('/v1/bookings', authenticate, validateBookingCreationV1, async (req, res, next) => {
  // Existing logic
});

// Version 2 (new)
router.post('/v2/bookings', authenticate, validateBookingCreationV2, async (req, res, next) => {
  // Enhanced logic with new features
  // Can reuse v1 logic internally
});
```

**Benefits:**
- ✅ Existing clients unaffected
- ✅ Gradual migration
- ✅ Can deprecate old version later

---

### 7.2 Suggested Guardrails and Validations

#### **Input Validation**

**Backend Validators (`backend/validators/`):**
```javascript
// Always validate input
const validateBookingCreation = [
  body('slot_id').isUUID().notEmpty(),
  body('trainer_id').isUUID().notEmpty(),
  body('vehicle_id').isUUID().notEmpty(),
  body('phone').matches(/^[0-9]{10}$/).optional(),
  handleValidationErrors
];
```

**Recommendations:**
- ✅ Validate all inputs (never trust client)
- ✅ Use express-validator for consistency
- ✅ Return clear error messages
- ✅ Sanitize inputs (prevent SQL injection, XSS)

---

#### **Business Rule Validation**

**Centralized Configuration:**
```javascript
// backend/config/app.config.js
module.exports = {
  booking: {
    weeklyLimit: 2,
    totalLimit: 2,
    advanceHours: 24,
    cancellationHours: 5,
  },
  slot: {
    maxCapacity: 5,
    visibilityHours: 24,
  }
};
```

**Recommendations:**
- ✅ Centralize all business rules
- ✅ Use constants (never magic numbers)
- ✅ Document all rules
- ✅ Make rules configurable (environment variables)

---

#### **Transaction Management**

**Best Practices:**
```javascript
// Always use transactions for multi-step operations
const client = await db.getClient();
try {
  await client.query('BEGIN');
  
  // Step 1: Validate
  // Step 2: Insert booking
  // Step 3: Update slot
  // Step 4: Update user stats
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**Recommendations:**
- ✅ Use transactions for all multi-step operations
- ✅ Always rollback on error
- ✅ Release connection in finally block
- ✅ Keep transactions short (avoid long-running locks)

---

### 7.3 Backward Compatibility Rules

#### **Rule 1: Never Remove Required Fields**

**Bad:**
```javascript
// Removing required field breaks existing clients
router.post('/bookings', async (req, res, next) => {
  // vehicle_id removed - existing clients will fail
});
```

**Good:**
```javascript
// Mark as deprecated, support both
router.post('/bookings', async (req, res, next) => {
  const vehicleId = req.body.vehicle_id || req.body.preferred_vehicle_id;
  // Support both old and new field names
});
```

---

#### **Rule 2: Never Change Response Structure**

**Bad:**
```javascript
// Changing response breaks existing clients
res.json({ booking_id: booking.id }); // Was: { id: booking.id }
```

**Good:**
```javascript
// Support both formats
res.json({
  id: booking.id,
  booking_id: booking.id, // New field, old field still present
});
```

---

#### **Rule 3: Never Break Existing Behavior**

**Bad:**
```javascript
// Changing business logic breaks expectations
if (weeklyCount >= 1) { // Was: >= 2
  throw new Error('Limit reached');
}
```

**Good:**
```javascript
// Use feature flag or version
if (FEATURES.NEW_WEEKLY_LIMIT) {
  if (weeklyCount >= 1) {
    throw new Error('Limit reached');
  }
} else {
  if (weeklyCount >= 2) {
    throw new Error('Limit reached');
  }
}
```

---

## 8. TESTING STRATEGY

### 8.1 Unit Test Areas

#### **Backend Unit Tests**

**1. Validators (`backend/validators/`)**
```javascript
describe('validateBookingCreation', () => {
  it('should reject missing slot_id', () => {
    // Test missing required field
  });
  
  it('should reject invalid UUID', () => {
    // Test invalid format
  });
  
  it('should accept valid booking data', () => {
    // Test valid input
  });
});
```

**2. Business Logic (`backend/routes/bookings.js`)**
```javascript
describe('Booking Creation', () => {
  it('should enforce weekly limit', () => {
    // Mock user with 1 booking this week
    // Attempt to create second booking
    // Expect error
  });
  
  it('should enforce 24-hour advance rule', () => {
    // Mock slot 23 hours away
    // Attempt to book
    // Expect error
  });
  
  it('should prevent double booking', () => {
    // Mock existing booking for same slot
    // Attempt to create duplicate
    // Expect error
  });
});
```

**3. Slot Generation (`backend/routes/slots.js`)**
```javascript
describe('Slot Generation', () => {
  it('should generate weekday slots correctly', () => {
    // Test Monday slot generation
    // Verify times: 7:00 AM to 9:00 PM, 30-min intervals
  });
  
  it('should generate Sunday slots correctly', () => {
    // Test Sunday slot generation
    // Verify morning and evening slots
  });
  
  it('should be idempotent', () => {
    // Generate slots twice
    // Verify no duplicates
  });
});
```

---

#### **Frontend Unit Tests**

**1. Components (`src/app/pages/booking/`)**
```typescript
describe('BookingComponent', () => {
  it('should prevent past date navigation', () => {
    // Set selectedDate to yesterday
    // Call changeDate(-1)
    // Expect date to remain today
  });
  
  it('should filter out past slots for today', () => {
    // Mock slots with past times
    // Call loadSlots()
    // Expect past slots filtered out
  });
  
  it('should validate phone number format', () => {
    // Enter invalid phone
    // Attempt to submit
    // Expect validation error
  });
});
```

**2. Services (`src/app/services/`)**
```typescript
describe('BookingService', () => {
  it('should handle API errors gracefully', () => {
    // Mock HTTP error
    // Call createBooking()
    // Expect error handling
  });
  
  it('should update local state on success', () => {
    // Mock successful booking
    // Call createBooking()
    // Expect slots$ updated
  });
});
```

---

### 8.2 Integration Test Flows

#### **Flow 1: Complete Booking Lifecycle**

```javascript
describe('Complete Booking Lifecycle', () => {
  it('should allow user to book and cancel', async () => {
    // 1. Create user
    const user = await createTestUser();
    
    // 2. Submit recognition
    await submitRecognition(user.id);
    await approveRecognition(user.id);
    
    // 3. Create entitlements
    await createEntitlements(user.id, { total_slots: 10 });
    
    // 4. Generate slots
    const slots = await generateSlots('2026-01-20');
    const slot = slots[0];
    
    // 5. Assign trainer
    const trainer = await createTestTrainer();
    await assignTrainer(slot.id, trainer.id);
    
    // 6. Create booking
    const booking = await createBooking(user.id, slot.id, trainer.id);
    expect(booking.status).toBe('confirmed');
    
    // 7. Verify slot updated
    const updatedSlot = await getSlot(slot.id);
    expect(updatedSlot.booked_count).toBe(1);
    
    // 8. Cancel booking
    await cancelBooking(booking.id, user.id);
    
    // 9. Verify slot restored
    const restoredSlot = await getSlot(slot.id);
    expect(restoredSlot.booked_count).toBe(0);
  });
});
```

---

#### **Flow 2: Race Condition Prevention**

```javascript
describe('Race Condition Prevention', () => {
  it('should prevent double booking on same slot', async () => {
    const slot = await createTestSlot({ capacity: 1 });
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // Both users try to book simultaneously
    const [booking1, booking2] = await Promise.allSettled([
      createBooking(user1.id, slot.id),
      createBooking(user2.id, slot.id),
    ]);
    
    // One should succeed, one should fail
    const successes = [booking1, booking2].filter(r => r.status === 'fulfilled');
    const failures = [booking1, booking2].filter(r => r.status === 'rejected');
    
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].reason.message).toContain('full');
  });
});
```

---

#### **Flow 3: Weekly Limit Enforcement**

```javascript
describe('Weekly Limit Enforcement', () => {
  it('should enforce 1 booking per week', async () => {
    const user = await createTestUser();
    await setupUserForBooking(user.id);
    
    // Create booking on Monday
    const mondaySlot = await createTestSlot({ date: '2026-01-20' }); // Monday
    await createBooking(user.id, mondaySlot.id);
    
    // Try to create second booking same week
    const tuesdaySlot = await createTestSlot({ date: '2026-01-21' }); // Tuesday
    await expect(createBooking(user.id, tuesdaySlot.id))
      .rejects.toThrow('Weekly booking limit reached');
    
    // Should allow booking next week
    const nextMondaySlot = await createTestSlot({ date: '2026-01-27' }); // Next Monday
    const booking = await createBooking(user.id, nextMondaySlot.id);
    expect(booking).toBeDefined();
  });
});
```

---

### 8.3 Manual Test Scenarios

#### **Scenario 1: Happy Path - User Books Successfully**

**Steps:**
1. User signs in with Google
2. User submits student recognition (invoice)
3. Admin approves recognition
4. User views available slots
5. User selects slot, trainer, vehicle
6. User enters phone number
7. User completes CAPTCHA
8. User submits booking
9. User receives confirmation

**Expected Results:**
- ✅ Booking created successfully
- ✅ Slot capacity decremented
- ✅ User sees booking in profile
- ✅ Email/WhatsApp notification sent

---

#### **Scenario 2: Edge Case - Booking at Exact 24-Hour Mark**

**Steps:**
1. Create slot for tomorrow at 2:00 PM
2. Wait until today at 2:00 PM
3. Attempt to book slot

**Expected Results:**
- ✅ Booking allowed (exactly 24 hours)
- ⚠️ If server time differs, may be denied

---

#### **Scenario 3: Edge Case - Cancellation at Exact 5-Hour Mark**

**Steps:**
1. Create booking for slot 5 hours from now
2. Wait until exactly 5 hours before slot
3. Attempt to cancel

**Expected Results:**
- ❌ Cancellation denied (must be > 5 hours)
- ✅ Error message shown

---

#### **Scenario 4: Admin - Generate Slots for Existing Date**

**Steps:**
1. Admin generates slots for 2026-01-20
2. Admin generates slots for same date again
3. Check results

**Expected Results:**
- ✅ No duplicates created
- ✅ Existing slots updated (if config changed)
- ✅ Summary shows "X updated, Y inserted"

---

#### **Scenario 5: Race Condition - Two Users Book Last Slot**

**Steps:**
1. Create slot with capacity = 1
2. Have two users open booking page simultaneously
3. Both users see slot as available
4. Both users click "Book" at same time

**Expected Results:**
- ✅ One booking succeeds
- ✅ One booking fails with "Slot is full" error
- ✅ Slot capacity = 1 (not 2)

---

### 8.4 Regression Checklist Before Deployment

#### **Pre-Deployment Checklist**

**Authentication & Authorization:**
- [ ] Google OAuth login works
- [ ] Admin login works
- [ ] Token expiration handled correctly
- [ ] Unauthorized access blocked
- [ ] User can only access own bookings

**Booking Flow:**
- [ ] User can view available slots
- [ ] 24-hour advance rule enforced
- [ ] Weekly limit enforced (1 per week)
- [ ] Total limit enforced (max 2)
- [ ] Student recognition required
- [ ] Entitlements checked
- [ ] Double booking prevented
- [ ] Race conditions handled

**Cancellation Flow:**
- [ ] User can cancel own bookings
- [ ] 5-hour cutoff enforced
- [ ] Slot capacity restored
- [ ] User cannot cancel others' bookings

**Admin Functions:**
- [ ] Slot generation works
- [ ] Trainer assignment works
- [ ] Slot editing works
- [ ] Booking status updates work
- [ ] Cannot delete trainer with bookings
- [ ] Cannot delete slot with bookings

**Data Consistency:**
- [ ] Slot capacity never exceeds booked_count
- [ ] Weekly counts accurate
- [ ] Total counts accurate
- [ ] Slot status updates correctly

**Edge Cases:**
- [ ] Past date navigation prevented (users)
- [ ] Invalid date formats handled
- [ ] Timezone differences handled
- [ ] DST transitions handled
- [ ] Network errors handled
- [ ] Database errors handled

**Performance:**
- [ ] Page load times acceptable
- [ ] API response times acceptable
- [ ] No memory leaks
- [ ] Connection pool not exhausted

**Security:**
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] CSRF protection enabled
- [ ] Sensitive data not exposed
- [ ] Rate limiting works

---

## APPENDIX: Configuration Reference

### Business Rules Configuration

**File:** `backend/config/app.config.js`
```javascript
booking: {
  weeklyLimit: 2,              // Actually 1 per week
  totalLimit: 2,                // Max 2 active bookings
  advanceHours: 24,             // 24-hour advance booking
  cancellationHours: 5,         // 5-hour cancellation cutoff
}

slot: {
  maxCapacity: 5,               // Fixed capacity per slot
  visibilityHours: 24,          // 24-hour visibility rule
  vehicleCapacity: {
    electric: 3,
    petrol: 1,
    bike: 1,
    total: 5
  }
}
```

### Database Constraints

**Slot Capacity:**
- `capacity = 5` (fixed)
- `booked_count <= capacity`
- `electric_capacity + petrol_capacity + bike_capacity = 5`

**Booking Limits:**
- Weekly: 1 booking per week (Monday-Sunday)
- Total: 2 active bookings (not cancelled)

**Cancellation:**
- Must be > 5 hours before slot start

**Visibility:**
- Slots visible if `start_time >= NOW() + 24 hours`

---

## CONCLUSION

This document provides a comprehensive analysis of the Kolkata Scooty Bike Training Booking System. Key findings:

1. **Robust Booking System:** Atomic transactions and row-level locking prevent race conditions
2. **Business Rules Enforced:** Weekly limits, advance booking, cancellation windows all validated
3. **Admin Controls:** Slot generation, trainer assignment, booking management all functional
4. **Edge Cases Handled:** Most edge cases have protection, some need improvement
5. **Testing Needed:** Comprehensive test suite recommended

**Priority Recommendations:**
1. Fix timezone handling (use UTC consistently)
2. Add server-side pagination for admin views
3. Implement feature flags for gradual rollouts
4. Add comprehensive test suite
5. Document API versioning strategy

---

**Document End**
