# Comprehensive Project Analysis
## Kolkata Bike Training Management System

**Date:** 2026-01-24  
**Tech Stack:** Angular (Frontend) + Node.js/Express (Backend) + PostgreSQL (Database)  
**Note:** User mentioned "React" but project uses **Angular 20+**

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Database Schema Analysis](#2-database-schema-analysis)
3. [Missing Tables & Schema Mismatches](#3-missing-tables--schema-mismatches)
4. [API Routes Verification](#4-api-routes-verification)
5. [Runtime Errors & Bugs](#5-runtime-errors--bugs)
6. [Booking Logic Issues](#6-booking-logic-issues)
7. [Execution Flow Diagrams](#7-execution-flow-diagrams)
8. [Priority-Ordered Bug List](#8-priority-ordered-bug-list)
9. [SQL Fixes & Recommendations](#9-sql-fixes--recommendations)

---

## 1. PROJECT OVERVIEW

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Angular 20+)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ User Pages   │  │ Admin Panel  │  │ Components   │     │
│  │ - Home       │  │ - Dashboard  │  │ - Toast      │     │
│  │ - Booking    │  │ - Slots      │  │ - Captcha    │     │
│  │ - Profile    │  │ - Bookings   │  │              │     │
│  │ - Trainers   │  │ - Vehicles   │  │              │     │
│  └──────────────┘  │ - Audit Logs │  └──────────────┘     │
│                    └──────────────┘                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST API
                           │ (JWT Authentication)
┌──────────────────────────▼──────────────────────────────────┐
│              BACKEND (Node.js + Express)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │  │   Services   │  │ Middleware   │     │
│  │ - auth.js    │  │ - booking     │  │ - auth.js    │     │
│  │ - slots.js   │  │   Validation │  │ - error      │     │
│  │ - bookings.js│  │ - vehicle     │  │   Handler    │     │
│  │ - admin.js   │  │ - audit       │  │              │     │
│  │ - vehicles.js│  │ - email       │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL Queries
                           │ (pg library)
┌──────────────────────────▼──────────────────────────────────┐
│              DATABASE (PostgreSQL)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Core       │  │   Junction   │  │   Audit      │     │
│  │ - profiles   │  │ - slot_      │  │ - admin_     │     │
│  │ - slots      │  │   vehicle_    │  │   audit_log  │     │
│  │ - bookings   │  │   capacity   │  │              │     │
│  │ - trainers   │  │               │  │              │     │
│  │ - vehicles   │  │               │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Features

- **User Features:**
  - Google OAuth authentication
  - Real-time slot booking
  - Vehicle selection (Electric, Petrol, Bike)
  - Booking management (view, cancel)
  - Student recognition (invoice upload)
  - Student entitlements (slot limits)

- **Admin Features:**
  - Slot management (create, edit, delete, generate)
  - Booking management
  - Trainer management
  - Vehicle management (dynamic)
  - User management
  - Audit logs
  - Settings configuration

### 1.3 Business Rules

1. **Slot Duration:** 30 minutes per slot
2. **Capacity:** Max 5 trainees per slot (total)
3. **Vehicle Capacity:** 
   - Electric: 3 per slot
   - Petrol: 1 per slot
   - Bike: 1 per slot
4. **Weekly Limit:** Max 2 bookings per week per phone (based on `slot_date`)
5. **Advance Booking:** Slots visible/bookable 24 hours before start
6. **Cancellation:** Allowed only ≥ 5 hours before slot start
7. **Phone Uniqueness:** Phone number = unique user identity
8. **Student Recognition:** Invoice approval required before booking
9. **Student Entitlements:** Fixed total slots with expiry dates

---

## 2. DATABASE SCHEMA ANALYSIS

### 2.1 Core Tables (Expected)

| Table | Purpose | Status |
|-------|---------|--------|
| `profiles` | User accounts (customers, trainers, admins) | ✅ Exists |
| `slots` | Training time slots | ✅ Exists |
| `bookings` | User bookings | ✅ Exists |
| `trainers` | Trainer profiles | ✅ Exists |
| `vehicles` | Vehicle types (dynamic) | ✅ Exists |
| `slot_vehicle_capacity` | Vehicle capacity per slot | ⚠️ **May be missing** |
| `student_recognition` | Invoice submissions | ✅ Exists |
| `student_entitlements` | Booking entitlements | ✅ Exists |
| `admin_audit_log` | Admin action logs | ✅ Exists |
| `settings` | System configuration | ✅ Exists |
| `audit_logs` | Legacy audit logs | ✅ Exists (deprecated) |
| `ratings` | Trainer ratings | ❓ **Not found in migrations** |

### 2.2 Table Schema Details

#### **profiles** Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,  -- ⚠️ Should have UNIQUE constraint (added in migration 20260122)
  avatar_url TEXT,
  role TEXT CHECK (role IN ('customer', 'trainer', 'admin', 'superadmin')),
  password_hash TEXT,
  google_id TEXT UNIQUE,
  total_bookings INTEGER DEFAULT 0,
  last_booking_date DATE,
  weekly_booking_count INTEGER DEFAULT 0,
  weekly_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ⚠️ `phone` unique constraint may not be applied (migration `20260122000000_phase5_phone_unique_constraint.sql` must be run)
- ✅ All required columns exist

#### **slots** Table
```sql
CREATE TABLE slots (
  id UUID PRIMARY KEY,
  trainer_id UUID REFERENCES trainers(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  slot_date DATE NOT NULL,
  capacity INTEGER DEFAULT 5 CHECK (capacity > 0),
  booked_count INTEGER DEFAULT 0 CHECK (booked_count >= 0),
  status TEXT CHECK (status IN ('available', 'full', 'cancelled', 'completed', 'disabled')),
  is_auto_generated BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  -- Legacy columns (deprecated, kept for backward compatibility):
  electric_capacity INTEGER,  -- ⚠️ Deprecated, use slot_vehicle_capacity
  petrol_capacity INTEGER,    -- ⚠️ Deprecated, use slot_vehicle_capacity
  bike_capacity INTEGER,       -- ⚠️ Deprecated, use slot_vehicle_capacity
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (booked_count <= capacity)
);
```

**Issues:**
- ⚠️ Legacy `electric_capacity`, `petrol_capacity`, `bike_capacity` columns still exist (should use `slot_vehicle_capacity` table)
- ✅ All required columns exist

#### **bookings** Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id),
  vehicle_id UUID REFERENCES vehicles(id),  -- ✅ Added in migration 20260120
  phone TEXT NOT NULL,  -- ✅ Added in migration 20260120
  vehicle_type vehicle_type_enum,  -- ⚠️ Legacy enum, should use vehicle_id
  status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ⚠️ `vehicle_type` enum column exists but is deprecated (should use `vehicle_id`)
- ✅ `vehicle_id` and `phone` columns exist

#### **vehicles** Table
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,  -- ✅ Added in migration 20260123
  max_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_per_slot > 0),  -- ✅ Added in migration 20260123
  is_active BOOLEAN NOT NULL DEFAULT true,  -- ✅ Added in migration 20260123
  -- Legacy columns (kept for backward compatibility):
  type TEXT,
  vehicle_subtype TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ✅ All required columns exist
- ⚠️ Legacy columns still present (for backward compatibility)

#### **slot_vehicle_capacity** Table
```sql
CREATE TABLE slot_vehicle_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, vehicle_id)
);
```

**Issues:**
- ⚠️ **CRITICAL:** Table may not exist if migration `20260124000000_create_slot_vehicle_capacity.sql` hasn't been run
- ✅ Schema is correct (if table exists)

#### **student_recognition** Table
```sql
CREATE TABLE student_recognition (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  invoice_url TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ✅ Table exists (migration `20260117000000_create_student_recognition.sql`)

#### **student_entitlements** Table
```sql
CREATE TABLE student_entitlements (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  total_slots INTEGER NOT NULL,
  used_slots INTEGER DEFAULT 0,
  expiry_date DATE,
  first_booking_date DATE,  -- ⚠️ May be missing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ⚠️ `first_booking_date` column may be missing (referenced in code but not in migration)

#### **admin_audit_log** Table
```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Issues:**
- ✅ Table exists (migration `20260121000000_phase4_admin_audit_log.sql`)

### 2.3 Missing Tables

| Table | Purpose | Status | Impact |
|-------|---------|--------|--------|
| `ratings` | Trainer ratings | ❌ **Missing** | Low - Ratings feature may not work |

**Note:** `ratings` table is referenced in `backend/routes/ratings.js` but no migration creates it.

---

## 3. MISSING TABLES & SCHEMA MISMATCHES

### 3.1 Critical Missing Tables

#### ❌ **ratings** Table Missing

**Referenced in:** `backend/routes/ratings.js`

**Expected Schema:**
```sql
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id, user_id)  -- One rating per booking per user
);

CREATE INDEX idx_ratings_trainer_id ON ratings(trainer_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
```

**Impact:** Ratings API endpoints will fail with `relation "ratings" does not exist`

### 3.2 Schema Mismatches

#### ⚠️ **bookings.vehicle_type** vs **bookings.vehicle_id**

**Issue:** 
- `vehicle_type` enum column exists (legacy)
- `vehicle_id` UUID column exists (new)
- Code uses `vehicle_id` but `vehicle_type` is still in schema

**Impact:** 
- Low - Code correctly uses `vehicle_id`
- `vehicle_type` can be removed in future migration

#### ⚠️ **slots.electric_capacity** vs **slot_vehicle_capacity**

**Issue:**
- Legacy columns `electric_capacity`, `petrol_capacity`, `bike_capacity` still exist on `slots`
- New `slot_vehicle_capacity` table should be used instead

**Impact:**
- Medium - Code uses new table, but legacy columns cause confusion
- Should be removed after full migration

#### ⚠️ **student_entitlements.first_booking_date**

**Issue:**
- Code references `first_booking_date` in `backend/routes/bookings.js` line 330
- Migration `20260118000000_create_student_entitlements.sql` doesn't create this column

**Impact:**
- High - Query will fail: `column "first_booking_date" does not exist`

### 3.3 Missing Indexes

**Performance Issues:**
- Missing index on `bookings(slot_id, vehicle_id, status)` for capacity checks
- Missing index on `bookings(phone, slot_date)` for weekly limit checks
- Missing index on `slot_vehicle_capacity(slot_id, vehicle_id)` (exists in migration but may not be applied)

---

## 4. API ROUTES VERIFICATION

### 4.1 Authentication Routes (`/api/auth`)

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/api/auth/login` | ✅ | Admin login |
| GET | `/api/auth/google` | ✅ | OAuth initiation |
| GET | `/api/auth/google/callback` | ✅ | OAuth callback |
| POST | `/api/auth/logout` | ✅ | Logout |
| GET | `/api/auth/me` | ✅ | Get current user |

**Issues:** None

### 4.2 Slot Routes (`/api/slots`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| GET | `/api/slots` | ✅ | None |
| GET | `/api/slots/date/:date` | ⚠️ | **May fail if `slot_vehicle_capacity` table missing** |
| GET | `/api/slots/range` | ✅ | None |
| GET | `/api/slots/available` | ⚠️ | **May fail if `slot_vehicle_capacity` table missing** |
| GET | `/api/slots/:id` | ⚠️ | **May fail if `slot_vehicle_capacity` table missing** |
| POST | `/api/slots` | ✅ | Creates `slot_vehicle_capacity` entries |
| PUT | `/api/slots/:id` | ✅ | Updates `slot_vehicle_capacity` entries |
| PUT | `/api/slots/:id/vehicle-capacity` | ⚠️ | **May fail if `slot_vehicle_capacity` table missing** |
| PUT | `/api/slots/:id/trainer` | ✅ | None |
| PUT | `/api/slots/:id/status` | ✅ | None |
| PUT | `/api/slots/:id/toggle` | ✅ | None |
| DELETE | `/api/slots/:id` | ✅ | None |
| DELETE | `/api/slots/date/:date` | ✅ | None |
| POST | `/api/slots/generate` | ✅ | Creates `slot_vehicle_capacity` entries |
| GET | `/api/slots/next-available-date` | ✅ | None |
| POST | `/api/slots/generate-daily` | ✅ | None |
| POST | `/api/slots/update-visibility` | ✅ | None |
| POST | `/api/slots/ensure-daily` | ✅ | None |

**Critical Issues:**
- ⚠️ **5 endpoints** will fail if `slot_vehicle_capacity` table doesn't exist

### 4.3 Booking Routes (`/api/bookings`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| POST | `/api/bookings` | ⚠️ | **May fail if `student_entitlements.first_booking_date` missing** |
| GET | `/api/bookings/my-bookings` | ✅ | None |
| PUT | `/api/bookings/:id/cancel` | ✅ | None |

**Critical Issues:**
- ⚠️ **1 endpoint** references missing column `first_booking_date`

### 4.4 Vehicle Routes (`/api/vehicles`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| GET | `/api/vehicles` | ✅ | None |
| GET | `/api/vehicles/:id` | ✅ | None |
| POST | `/api/vehicles` | ✅ | None |
| PUT | `/api/vehicles/:id` | ✅ | None |
| DELETE | `/api/vehicles/:id` | ✅ | None |

**Issues:** None

### 4.5 Rating Routes (`/api/ratings`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| POST | `/api/ratings` | ❌ | **Will fail: `ratings` table missing** |
| GET | `/api/ratings/trainer/:trainerId` | ❌ | **Will fail: `ratings` table missing** |

**Critical Issues:**
- ❌ **2 endpoints** will fail completely

### 4.6 Admin Routes (`/api/admin`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| GET | `/api/admin/bookings` | ✅ | None |
| GET | `/api/admin/users` | ✅ | None |
| GET | `/api/admin/customers` | ✅ | None |
| GET | `/api/admin/customers/export` | ✅ | None |
| GET | `/api/admin/dashboard` | ✅ | None |
| GET | `/api/admin/stats` | ✅ | None |
| GET | `/api/admin/trainers` | ✅ | None |
| POST | `/api/admin/trainers` | ✅ | None |
| PUT | `/api/admin/trainers/:id` | ✅ | None |
| DELETE | `/api/admin/trainers/:id` | ✅ | None |
| GET | `/api/admin/slots` | ⚠️ | **May fail if `slot_vehicle_capacity` table missing** |
| POST | `/api/admin/slots` | ✅ | None |
| PUT | `/api/admin/slots/:id` | ✅ | None |
| DELETE | `/api/admin/slots/:id` | ✅ | None |
| GET | `/api/admin/settings` | ✅ | None |
| PUT | `/api/admin/settings` | ✅ | None |
| PUT | `/api/admin/bookings/:id/status` | ✅ | None |
| DELETE | `/api/admin/bookings/:id` | ✅ | None |
| POST | `/api/admin/users` | ✅ | None |
| PUT | `/api/admin/users/:id` | ✅ | None |
| PUT | `/api/admin/users/:id/role` | ✅ | None |
| DELETE | `/api/admin/users/:id` | ✅ | None |
| GET | `/api/admin/audit-logs` | ✅ | None |

**Issues:** 1 endpoint may fail

### 4.7 Recognition Routes (`/api/recognition`)

| Method | Endpoint | Status | Issues |
|--------|----------|--------|--------|
| POST | `/api/recognition` | ✅ | None |
| GET | `/api/recognition/status` | ✅ | None |
| PUT | `/api/recognition/:id/approve` | ✅ | None |
| PUT | `/api/recognition/:id/reject` | ✅ | None |

**Issues:** None

---

## 5. RUNTIME ERRORS & BUGS

### 5.1 Critical Runtime Errors (Blockers)

#### ❌ **ERROR-001: slot_vehicle_capacity Table Missing**

**Error:** `PostgreSQL error 42P01 – relation "slot_vehicle_capacity" does not exist`

**Triggered From:**
- `GET /api/slots/date/:date` (line 162 in `backend/routes/slots.js`)
- `GET /api/slots/available` (line 305 in `backend/routes/slots.js`)
- `GET /api/slots/:id` (line 414 in `backend/routes/slots.js`)
- `PUT /api/slots/:id/vehicle-capacity` (line 305 in `backend/routes/slots.js`)
- `GET /api/admin/slots` (if uses same query)

**Root Cause:**
- Migration `20260124000000_create_slot_vehicle_capacity.sql` hasn't been run
- Prerequisite migration `20260123000000_refactor_vehicles_table.sql` may also be missing

**Fix Priority:** 🔴 **CRITICAL**

**SQL Fix:**
```sql
-- Run migration: supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql
-- Ensure prerequisite: supabase/migrations/20260123000000_refactor_vehicles_table.sql
```

#### ❌ **ERROR-002: ratings Table Missing**

**Error:** `PostgreSQL error 42P01 – relation "ratings" does not exist`

**Triggered From:**
- `POST /api/ratings` (line 24 in `backend/routes/ratings.js`)
- `GET /api/ratings/trainer/:trainerId` (line 93 in `backend/routes/ratings.js`)

**Root Cause:**
- No migration creates `ratings` table
- Table is referenced in code but doesn't exist

**Fix Priority:** 🟡 **HIGH**

**SQL Fix:**
```sql
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

CREATE INDEX idx_ratings_trainer_id ON ratings(trainer_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
```

#### ❌ **ERROR-003: student_entitlements.first_booking_date Missing**

**Error:** `PostgreSQL error 42703 – column "first_booking_date" does not exist`

**Triggered From:**
- `POST /api/bookings` (line 330 in `backend/routes/bookings.js`)

**Root Cause:**
- Code references `first_booking_date` but migration doesn't create it

**Fix Priority:** 🔴 **CRITICAL**

**SQL Fix:**
```sql
ALTER TABLE student_entitlements 
ADD COLUMN IF NOT EXISTS first_booking_date DATE;
```

### 5.2 High Priority Runtime Errors

#### ⚠️ **ERROR-004: Phone Unique Constraint Missing**

**Error:** `Duplicate phone numbers allowed` (no error, but business rule violation)

**Triggered From:**
- `POST /api/bookings` (phone validation)
- `PUT /api/profiles/me` (phone update)

**Root Cause:**
- Migration `20260122000000_phase5_phone_unique_constraint.sql` may not be run
- Unique index `idx_profiles_phone_unique` missing

**Fix Priority:** 🟡 **HIGH**

**SQL Fix:**
```sql
-- Run migration: supabase/migrations/20260122000000_phase5_phone_unique_constraint.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
ON profiles(phone) 
WHERE phone IS NOT NULL;
```

### 5.3 Medium Priority Issues

#### ⚠️ **ERROR-005: Date Navigation Bug**

**Error:** Date jumps incorrectly (e.g., Jan 17 → Jan 15)

**Triggered From:**
- Frontend: `src/app/pages/booking/booking.component.ts` (line 357-382)

**Root Cause:**
- Timezone conversion issues in date arithmetic
- `addDays()` utility may not handle edge cases

**Fix Priority:** 🟢 **MEDIUM**

**Fix:**
```typescript
// Use UTC dates consistently
changeDate(days: number) {
  const date = new Date(this.selectedDate);
  date.setUTCDate(date.getUTCDate() + days);
  this.selectedDate = date.toISOString().split('T')[0];
}
```

---

## 6. BOOKING LOGIC ISSUES

### 6.1 Booking Creation Flow Issues

#### ⚠️ **ISSUE-001: Student Recognition Check**

**Location:** `backend/routes/bookings.js` line 30-45

**Issue:**
- Checks `student_recognition` table
- If no record exists, throws error
- But new users may not have submitted invoice yet

**Impact:** New users cannot book until invoice approved

**Status:** ✅ **By Design** (business rule)

#### ⚠️ **ISSUE-002: Student Entitlements Check**

**Location:** `backend/routes/bookings.js` line 48-75

**Issue:**
- Checks `student_entitlements` table
- If no record exists, throws error
- But new users may not have entitlements set up

**Impact:** New users cannot book until admin sets entitlements

**Status:** ✅ **By Design** (business rule)

#### ⚠️ **ISSUE-003: Missing first_booking_date Column**

**Location:** `backend/routes/bookings.js` line 330

**Issue:**
- Code queries `first_booking_date` from `student_entitlements`
- Column doesn't exist in migration

**Impact:** 🔴 **CRITICAL** - Query will fail

**Fix:** Add column (see ERROR-003)

### 6.2 Capacity Validation Issues

#### ⚠️ **ISSUE-004: Vehicle Capacity Check**

**Location:** `backend/routes/bookings.js` line 188-191

**Issue:**
- Uses `vehicleService.checkVehicleAvailability()`
- Relies on `slot_vehicle_capacity` table
- If table missing, will fail

**Impact:** 🔴 **CRITICAL** - Booking creation will fail

**Fix:** Ensure `slot_vehicle_capacity` table exists (see ERROR-001)

### 6.3 Weekly Limit Logic

#### ✅ **ISSUE-005: Weekly Limit Fixed**

**Location:** `backend/services/bookingValidation.service.js`

**Status:** ✅ **FIXED** in PHASE 5
- Changed from `created_at`-based to `slot_date`-based
- Correctly counts bookings by slot occurrence week

---

## 7. EXECUTION FLOW DIAGRAMS

### 7.1 Booking Creation Flow

```
┌─────────────┐
│   Frontend  │
│  (Angular)  │
└──────┬──────┘
       │ POST /api/bookings
       │ { slot_id, trainer_id, vehicle_id, phone }
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend: POST /api/bookings                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. BEGIN TRANSACTION                                 │  │
│  │ 2. Check student_recognition.status = 'approved'     │  │
│  │ 3. Check student_entitlements (not expired, slots) │  │
│  │ 4. Validate phone number (match profile or set)      │  │
│  │ 5. Validate booking eligibility (weekly limit, etc)│  │
│  │ 6. Check vehicle availability (slot_vehicle_capacity)│ │
│  │ 7. Lock slot: SELECT ... FOR UPDATE NOWAIT          │  │
│  │ 8. Check capacity again (double-check)              │  │
│  │ 9. INSERT booking                                    │  │
│  │ 10. UPDATE slots.booked_count += 1                  │  │
│  │ 11. UPDATE slot_vehicle_capacity (if needed)        │  │
│  │ 12. COMMIT TRANSACTION                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
       │
       │ SQL Queries
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tables Used:                                         │  │
│  │ - student_recognition                                │  │
│  │ - student_entitlements                               │  │
│  │ - profiles                                           │  │
│  │ - slots (FOR UPDATE NOWAIT)                          │  │
│  │ - slot_vehicle_capacity                              │  │
│  │ - vehicles                                           │  │
│  │ - bookings (INSERT)                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
       │
       │ Response
       ▼
┌─────────────┐
│   Frontend  │
│  (Angular)  │
└─────────────┘
```

**Potential Failure Points:**
1. ❌ `slot_vehicle_capacity` table missing → ERROR-001
2. ❌ `student_entitlements.first_booking_date` missing → ERROR-003
3. ❌ Slot locked by another transaction → 409 Conflict (handled)

### 7.2 Slot Generation Flow

```
┌─────────────┐
│   Admin UI  │
│  (Angular)  │
└──────┬──────┘
       │ POST /api/slots/generate
       │ { date: "2026-01-25" }
       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: POST /api/slots/generate                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Validate admin authentication                     │  │
│  │ 2. Parse date: [year, month, day]                   │  │
│  │ 3. Check existing slots for date                     │  │
│  │ 4. Get active vehicles (vehicleService)              │  │
│  │ 5. Generate slots (7 AM - 9 PM, 30-min intervals)  │  │
│  │ 6. For each slot:                                    │  │
│  │    - INSERT INTO slots                               │  │
│  │    - INSERT INTO slot_vehicle_capacity (per vehicle)│ │
│  │ 7. Ensure all slots have capacity entries            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
       │
       │ SQL Queries
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tables Used:                                         │  │
│  │ - vehicles (SELECT active vehicles)                  │  │
│  │ - slots (INSERT)                                     │  │
│  │ - slot_vehicle_capacity (INSERT)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Potential Failure Points:**
1. ❌ `slot_vehicle_capacity` table missing → ERROR-001
2. ❌ `vehicles.max_per_slot` column missing → Migration prerequisite

### 7.3 Slot Query Flow (GET /api/slots/date/:date)

```
┌─────────────┐
│   Frontend  │
│  (Angular)  │
└──────┬──────┘
       │ GET /api/slots/date/2026-01-25
       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: GET /api/slots/date/:date                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Ensure slot_vehicle_capacity entries exist        │  │
│  │    (calls ensure_slot_vehicle_capacities function)   │  │
│  │ 2. Query slots with JOINs:                          │  │
│  │    - LEFT JOIN trainers                             │  │
│  │    - LEFT JOIN profiles (trainer)                   │  │
│  │    - LEFT JOIN slot_vehicle_capacity                │  │
│  │    - LEFT JOIN vehicles                             │  │
│  │    - LEFT JOIN LATERAL (booked counts)              │  │
│  │ 3. Filter by slot_date                              │  │
│  │ 4. Group by slot columns                           │  │
│  │ 5. Aggregate vehicle_capacities (JSON)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
       │
       │ SQL Query
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SELECT s.*,                                         │  │
│  │   json_agg(vehicle_capacities)                      │  │
│  │ FROM slots s                                        │  │
│  │ LEFT JOIN slot_vehicle_capacity svc                 │  │
│  │ LEFT JOIN vehicles v                                │  │
│  │ LEFT JOIN LATERAL (booked counts)                   │  │
│  │ WHERE slot_date = $1                                │  │
│  │ GROUP BY s.id, ...                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Potential Failure Points:**
1. ❌ `slot_vehicle_capacity` table missing → ERROR-001
2. ❌ `ensure_slot_vehicle_capacities()` function missing → Warning only

---

## 8. PRIORITY-ORDERED BUG LIST

### 🔴 **CRITICAL PRIORITY** (Blockers)

#### **BUG-001: slot_vehicle_capacity Table Missing**
- **Error:** `relation "slot_vehicle_capacity" does not exist`
- **Impact:** 5+ API endpoints fail
- **Files:** `backend/routes/slots.js` (multiple locations)
- **Root Cause:** Migration `20260124000000_create_slot_vehicle_capacity.sql` not run
- **Fix:**
  ```bash
  # Run prerequisite first
  node backend/apply_migration.js supabase/migrations/20260123000000_refactor_vehicles_table.sql
  
  # Then run main migration
  node backend/apply_migration.js supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql
  ```
- **Priority:** 🔴 **CRITICAL**

#### **BUG-002: student_entitlements.first_booking_date Missing**
- **Error:** `column "first_booking_date" does not exist`
- **Impact:** Booking creation fails
- **Files:** `backend/routes/bookings.js` line 330
- **Root Cause:** Column not created in migration
- **Fix:**
  ```sql
  ALTER TABLE student_entitlements 
  ADD COLUMN IF NOT EXISTS first_booking_date DATE;
  ```
- **Priority:** 🔴 **CRITICAL**

### 🟡 **HIGH PRIORITY**

#### **BUG-003: ratings Table Missing**
- **Error:** `relation "ratings" does not exist`
- **Impact:** Ratings feature completely broken
- **Files:** `backend/routes/ratings.js`
- **Root Cause:** No migration creates table
- **Fix:** See SQL script in section 9
- **Priority:** 🟡 **HIGH**

#### **BUG-004: Phone Unique Constraint Missing**
- **Error:** Duplicate phones allowed (business rule violation)
- **Impact:** Data integrity issue
- **Files:** `backend/routes/bookings.js`, `backend/routes/profiles.js`
- **Root Cause:** Migration `20260122000000_phase5_phone_unique_constraint.sql` not run
- **Fix:**
  ```bash
  node backend/apply_migration.js supabase/migrations/20260122000000_phase5_phone_unique_constraint.sql
  ```
- **Priority:** 🟡 **HIGH**

### 🟢 **MEDIUM PRIORITY**

#### **BUG-005: Date Navigation Bug**
- **Error:** Date jumps incorrectly (Jan 17 → Jan 15)
- **Impact:** User experience issue
- **Files:** `src/app/pages/booking/booking.component.ts` line 357-382
- **Root Cause:** Timezone conversion issues
- **Fix:** Use UTC dates consistently (see section 5.3)
- **Priority:** 🟢 **MEDIUM**

#### **BUG-006: Slot Duration Not Enforced**
- **Error:** Slots can be created with any duration
- **Impact:** Business rule violation
- **Files:** `backend/routes/slots.js` (slot creation)
- **Root Cause:** No validation for 30-minute duration
- **Fix:** Add validation (see SYSTEM_GAP_ANALYSIS.md LB-006)
- **Priority:** 🟢 **MEDIUM**

### 🔵 **LOW PRIORITY**

#### **BUG-007: Legacy Columns Still Present**
- **Issue:** `slots.electric_capacity`, `bookings.vehicle_type` still exist
- **Impact:** Confusion, but no functional impact
- **Fix:** Remove in future migration after full migration
- **Priority:** 🔵 **LOW**

---

## 9. SQL FIXES & RECOMMENDATIONS

### 9.1 Critical SQL Fixes

#### **Fix 1: Create ratings Table**

**File:** `supabase/migrations/20260125000000_create_ratings_table.sql`

```sql
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

-- Create indexes
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
```

#### **Fix 2: Add first_booking_date Column**

**File:** `supabase/migrations/20260125000001_add_first_booking_date.sql`

```sql
-- Migration: Add first_booking_date to student_entitlements
-- Date: 2026-01-25
-- Description: Adds first_booking_date column referenced in booking creation

ALTER TABLE student_entitlements 
ADD COLUMN IF NOT EXISTS first_booking_date DATE;

COMMENT ON COLUMN student_entitlements.first_booking_date IS 'Date of first booking made by user (used for entitlement tracking)';
```

#### **Fix 3: Ensure slot_vehicle_capacity Table Exists**

**Action:** Run existing migration
```bash
# Prerequisite
node backend/apply_migration.js supabase/migrations/20260123000000_refactor_vehicles_table.sql

# Main migration
node backend/apply_migration.js supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql
```

#### **Fix 4: Ensure Phone Unique Constraint**

**Action:** Run existing migration
```bash
node backend/apply_migration.js supabase/migrations/20260122000000_phase5_phone_unique_constraint.sql
```

### 9.2 Performance Optimization SQL

#### **Fix 5: Add Missing Indexes**

```sql
-- Index for vehicle capacity checks
CREATE INDEX IF NOT EXISTS idx_bookings_slot_vehicle_status 
ON bookings(slot_id, vehicle_id, status) 
WHERE status NOT IN ('cancelled');

-- Index for weekly limit checks (phone + slot_date)
CREATE INDEX IF NOT EXISTS idx_bookings_phone_slot_date 
ON bookings(phone, slot_date) 
WHERE phone IS NOT NULL AND status NOT IN ('cancelled');

-- Index for slot_vehicle_capacity lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_slot_vehicle_capacity_slot_vehicle 
ON slot_vehicle_capacity(slot_id, vehicle_id);
```

### 9.3 Schema Cleanup (Future)

#### **Fix 6: Remove Legacy Columns** (After Full Migration)

```sql
-- Remove deprecated columns (run after confirming all code uses new tables)
-- WARNING: Only run after full migration and testing

-- Remove from slots table
ALTER TABLE slots DROP COLUMN IF EXISTS electric_capacity;
ALTER TABLE slots DROP COLUMN IF EXISTS petrol_capacity;
ALTER TABLE slots DROP COLUMN IF EXISTS bike_capacity;

-- Remove from bookings table
ALTER TABLE bookings DROP COLUMN IF EXISTS vehicle_type;

-- Remove enum type
DROP TYPE IF EXISTS vehicle_type_enum;
```

---

## 10. EXECUTION PLAN

### Phase 1: Critical Fixes (Immediate)

1. ✅ **Run slot_vehicle_capacity migration**
   ```bash
   node backend/apply_migration.js supabase/migrations/20260123000000_refactor_vehicles_table.sql
   node backend/apply_migration.js supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql
   ```

2. ✅ **Add first_booking_date column**
   ```bash
   node backend/apply_migration.js supabase/migrations/20260125000001_add_first_booking_date.sql
   ```

3. ✅ **Create ratings table**
   ```bash
   node backend/apply_migration.js supabase/migrations/20260125000000_create_ratings_table.sql
   ```

4. ✅ **Run phone unique constraint migration**
   ```bash
   node backend/apply_migration.js supabase/migrations/20260122000000_phase5_phone_unique_constraint.sql
   ```

### Phase 2: Verification

1. ✅ **Verify all tables exist**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. ✅ **Test critical endpoints**
   - `GET /api/slots/date/:date`
   - `POST /api/bookings`
   - `POST /api/ratings`

3. ✅ **Check indexes**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('slot_vehicle_capacity', 'ratings', 'bookings')
   ORDER BY tablename, indexname;
   ```

### Phase 3: Performance Optimization

1. ✅ **Add missing indexes** (see Fix 5)

2. ✅ **Verify query performance**
   - Use `EXPLAIN ANALYZE` on critical queries
   - Check for sequential scans

---

## SUMMARY

### Critical Issues Found: 2
1. ❌ `slot_vehicle_capacity` table missing
2. ❌ `student_entitlements.first_booking_date` column missing

### High Priority Issues: 2
1. ❌ `ratings` table missing
2. ⚠️ Phone unique constraint may be missing

### Medium Priority Issues: 2
1. ⚠️ Date navigation bug
2. ⚠️ Slot duration not enforced

### Total API Endpoints: 70+
### Endpoints at Risk: 8 (5 slots, 2 ratings, 1 bookings)

### Recommended Actions:
1. **Immediate:** Run all pending migrations
2. **Immediate:** Create `ratings` table migration
3. **Immediate:** Add `first_booking_date` column
4. **Short-term:** Fix date navigation bug
5. **Short-term:** Add slot duration validation
6. **Long-term:** Remove legacy columns

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-24  
**Status:** ✅ Complete Analysis
