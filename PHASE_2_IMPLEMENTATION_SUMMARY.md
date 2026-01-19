# PHASE 2: Database & Schema Fix - Implementation Summary

## ✅ Completed Changes

### 1. Database Migration: Vehicle-Based Bookings

**File Created:** `supabase/migrations/20260120000000_phase2_vehicle_based_bookings.sql`

**Schema Changes:**

#### **Bookings Table Enhancements:**

1. **Added `vehicle_type` Column:**
   - Type: `vehicle_type_enum` (ENUM: 'ELECTRIC', 'PETROL', 'BIKE')
   - NOT NULL constraint (after data migration)
   - Indexed for performance

2. **Added `phone` Column:**
   - Type: TEXT
   - Nullable (for backward compatibility with existing bookings)
   - Indexed for phone-based queries
   - Format validation constraint (10 digits when provided)

3. **Indexes Created:**
   - `idx_bookings_vehicle_type` - For vehicle type filtering
   - `idx_bookings_phone` - For phone-based lookups
   - `idx_bookings_phone_created_week` - For weekly booking limit checks
   - `idx_bookings_slot_vehicle_type` - For vehicle capacity checks

#### **Database Functions & Triggers:**

1. **Function: `check_vehicle_capacity(slot_id, vehicle_type)`**
   - Checks if capacity is available for specific vehicle type
   - Returns BOOLEAN
   - Used by trigger and application code

2. **Trigger: `trigger_validate_booking_vehicle_capacity`**
   - BEFORE INSERT on bookings table
   - Prevents overbooking at database level
   - Raises exception if vehicle capacity exceeded

3. **Constraint: `bookings_phone_format_check`**
   - Validates phone format (10 digits) when provided
   - Allows NULL for backward compatibility

---

### 2. Data Migration

**Existing Data Handling:**

1. **Vehicle Type Migration:**
   ```sql
   UPDATE bookings b
   SET vehicle_type = CASE
     WHEN v.vehicle_subtype LIKE '%Electric%' THEN 'ELECTRIC'
     WHEN v.vehicle_subtype LIKE '%Petrol%' THEN 'PETROL'
     WHEN v.vehicle_subtype = 'Bike' THEN 'BIKE'
     ELSE 'ELECTRIC' -- Default fallback
   END
   FROM vehicles v
   WHERE b.vehicle_id = v.id AND b.vehicle_type IS NULL;
   ```

2. **Phone Migration:**
   ```sql
   UPDATE bookings b
   SET phone = p.phone
   FROM profiles p
   WHERE b.user_id = p.id AND b.phone IS NULL AND p.phone IS NOT NULL;
   ```

**Backward Compatibility:**
- ✅ Existing bookings remain valid
- ✅ NULL vehicle_type set to 'ELECTRIC' (default)
- ✅ NULL phone allowed (for old bookings)

---

### 3. Backend Code Updates

#### **Booking Route (`backend/routes/bookings.js`)**

**Changes:**
1. ✅ Extract `vehicle_type` from validation result
2. ✅ Store `vehicle_type` and `phone` in booking insert
3. ✅ Updated atomic booking query to check vehicle-specific capacity
4. ✅ Include `vehicle_type` and `phone` in response

**Key Query Updates:**
```sql
-- PHASE 2: Vehicle-specific capacity check in locked_slot CTE
WITH locked_slot AS (
  SELECT s.*,
    (SELECT COUNT(*) FROM bookings 
     WHERE slot_id = s.id AND vehicle_type = 'ELECTRIC' 
     AND status NOT IN ('cancelled')) as electric_booked,
    (SELECT COUNT(*) FROM bookings 
     WHERE slot_id = s.id AND vehicle_type = 'PETROL' 
     AND status NOT IN ('cancelled')) as petrol_booked,
    (SELECT COUNT(*) FROM bookings 
     WHERE slot_id = s.id AND vehicle_type = 'BIKE' 
     AND status NOT IN ('cancelled')) as bike_booked
  FROM slots s WHERE s.id = $1 FOR UPDATE
),
slot_validation AS (
  SELECT ls.*,
    CASE
      WHEN $7::text = 'ELECTRIC' AND ls.electric_booked >= ls.electric_capacity 
        THEN 'VEHICLE_CAPACITY_FULL'
      WHEN $7::text = 'PETROL' AND ls.petrol_booked >= ls.petrol_capacity 
        THEN 'VEHICLE_CAPACITY_FULL'
      WHEN $7::text = 'BIKE' AND ls.bike_booked >= ls.bike_capacity 
        THEN 'VEHICLE_CAPACITY_FULL'
      ELSE 'VALID'
    END as validation_status
  FROM locked_slot ls
),
booking_insert AS (
  INSERT INTO bookings (user_id, slot_id, trainer_id, vehicle_id, vehicle_type, phone, status, notes)
  SELECT $2, $1, $3, $4, $7::vehicle_type_enum, $8, $6, $5
  FROM slot_validation
  WHERE validation_status = 'VALID'
  RETURNING *
)
```

---

#### **Validation Service (`backend/services/bookingValidation.service.js`)**

**Changes:**
1. ✅ Updated to use `vehicle_type` column directly (no vehicles table join)
2. ✅ Simplified vehicle capacity check query
3. ✅ Removed dependency on vehicles table for capacity checks

**Before (PHASE 1):**
```javascript
// Joined with vehicles table to get vehicle_subtype
const vehicleBookingsCheck = await db.query(`
  SELECT v.vehicle_subtype, COUNT(b.id) as booked_count
  FROM bookings b
  JOIN vehicles v ON b.vehicle_id = v.id
  WHERE b.slot_id = $1 AND b.status NOT IN ('cancelled')
  GROUP BY v.vehicle_subtype
`);
```

**After (PHASE 2):**
```javascript
// Direct query using vehicle_type column
const vehicleBookingsCheck = await db.query(`
  SELECT vehicle_type, COUNT(*) as booked_count
  FROM bookings
  WHERE slot_id = $1
    AND status NOT IN ('cancelled')
    AND vehicle_type IS NOT NULL
  GROUP BY vehicle_type
`);
```

---

#### **Slot Generation (`backend/routes/slots.js`)**

**Changes:**
1. ✅ Wrapped slot generation in database transaction
2. ✅ Uses transaction client for all slot operations
3. ✅ Rollback on error prevents partial slot creation

**Transaction Flow:**
```javascript
const client = await db.getClient();
try {
  await client.query('BEGIN');
  
  // Generate and insert slots...
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

### 4. Database Constraints & Safety

#### **Vehicle Capacity Constraints:**

1. **Check Constraint:**
   ```sql
   ALTER TABLE slots ADD CONSTRAINT slots_vehicle_capacity_check 
     CHECK (electric_capacity + petrol_capacity + bike_capacity = 5);
   ```

2. **Trigger-Based Validation:**
   - `trigger_validate_booking_vehicle_capacity` prevents overbooking
   - Raises exception before insert if capacity exceeded
   - Works at database level (cannot be bypassed)

3. **Application-Level Validation:**
   - Validation service checks capacity before booking
   - Atomic query checks capacity during insert
   - Double protection (application + database)

---

### 5. Slots Table Status

**Verified:** Slots table already has vehicle capacity columns:
- ✅ `electric_capacity` (INTEGER, DEFAULT 3)
- ✅ `petrol_capacity` (INTEGER, DEFAULT 1)
- ✅ `bike_capacity` (INTEGER, DEFAULT 1)
- ✅ Constraint: `electric_capacity + petrol_capacity + bike_capacity = 5`

**No changes needed** - columns exist from previous migrations.

---

## 🔄 Backward Compatibility

### **Maintained:**

1. ✅ **Existing Bookings:**
   - All existing bookings remain valid
   - Vehicle_type populated from vehicles table
   - Phone populated from profiles table
   - NULL values handled gracefully

2. ✅ **API Compatibility:**
   - Request format unchanged
   - Response includes new fields (vehicle_type, phone)
   - Old clients can ignore new fields

3. ✅ **Database Relationships:**
   - `vehicle_id` still maintained (for reference)
   - `user_id` still used for relationships
   - Phone used for business rules only

4. ✅ **Migration Safety:**
   - Idempotent migration (can run multiple times)
   - Handles NULL values gracefully
   - No data loss

---

## 📋 Database-Level Protection

### **Overbooking Prevention:**

1. **Trigger Protection:**
   - `trigger_validate_booking_vehicle_capacity` runs BEFORE INSERT
   - Checks capacity using `check_vehicle_capacity()` function
   - Raises exception if capacity exceeded
   - **Cannot be bypassed** - enforced at database level

2. **Application Protection:**
   - Validation service checks capacity before booking
   - Atomic query validates capacity during insert
   - Row-level locking prevents race conditions

3. **Constraint Protection:**
   - Vehicle capacity sum must equal 5
   - Phone format validated when provided
   - Vehicle_type must be valid enum value

---

## 🧪 Testing Recommendations

### **Database Migration Tests:**

1. **Migration Execution:**
   - Run migration on test database
   - Verify vehicle_type populated correctly
   - Verify phone populated correctly
   - Check indexes created

2. **Data Integrity:**
   - Verify no NULL vehicle_type after migration
   - Verify phone format constraint works
   - Verify trigger prevents overbooking

3. **Backward Compatibility:**
   - Test existing bookings still accessible
   - Test API responses include new fields
   - Test old API clients still work

### **Capacity Enforcement Tests:**

1. **Vehicle-Specific Capacity:**
   - Book 3 electric slots → Should succeed
   - Book 4th electric slot → Should fail (capacity = 3)
   - Book 1 petrol slot → Should succeed
   - Book 2nd petrol slot → Should fail (capacity = 1)

2. **Database Trigger:**
   - Attempt to insert booking exceeding capacity
   - Verify trigger raises exception
   - Verify booking not inserted

3. **Race Conditions:**
   - Two users book same vehicle type simultaneously
   - Verify only one succeeds
   - Verify capacity not exceeded

---

## ⚠️ Known Limitations & Future Enhancements

### **Current Limitations:**

1. **Phone Column:**
   - Currently nullable (for backward compatibility)
   - Future: Make NOT NULL after all bookings migrated
   - Future: Add unique constraint per phone + slot

2. **Slot Status:**
   - Still uses total `booked_count` for status
   - Future: Consider vehicle-specific status
   - Future: Show "Electric Full" vs "Petrol Available"

3. **Capacity Updates:**
   - No validation when admin changes vehicle capacity
   - Future: Prevent reducing capacity below current bookings
   - Future: Add audit log for capacity changes

---

## 📝 Migration Execution

### **Steps to Apply:**

1. **Backup Database:**
   ```sql
   -- Backup bookings table
   CREATE TABLE bookings_backup AS SELECT * FROM bookings;
   ```

2. **Run Migration:**
   ```bash
   # Apply migration
   psql -d your_database -f supabase/migrations/20260120000000_phase2_vehicle_based_bookings.sql
   ```

3. **Verify Migration:**
   ```sql
   -- Check vehicle_type populated
   SELECT COUNT(*) FROM bookings WHERE vehicle_type IS NULL;
   -- Should return 0
   
   -- Check phone populated
   SELECT COUNT(*) FROM bookings WHERE phone IS NULL;
   -- May return count > 0 (old bookings)
   
   -- Check indexes created
   SELECT indexname FROM pg_indexes WHERE tablename = 'bookings';
   ```

4. **Test Booking:**
   - Create new booking
   - Verify vehicle_type stored
   - Verify phone stored
   - Verify capacity check works

---

## ✅ Verification Checklist

- [x] Migration script created
- [x] vehicle_type enum created
- [x] vehicle_type column added to bookings
- [x] phone column added to bookings
- [x] Data migration for existing bookings
- [x] Indexes created
- [x] Database function created
- [x] Trigger created
- [x] Booking route updated
- [x] Validation service updated
- [x] Slot generation wrapped in transaction
- [x] Backward compatibility maintained
- [x] Error handling updated

---

## 🎯 Key Achievements

1. ✅ **Vehicle-Based Capacity:** Bookings now track vehicle_type directly
2. ✅ **Database-Level Protection:** Trigger prevents overbooking
3. ✅ **Phone-Based Identity:** Phone stored in bookings for direct validation
4. ✅ **Transaction Safety:** Slot generation wrapped in transaction
5. ✅ **Performance:** Indexes added for fast queries
6. ✅ **Backward Compatible:** Existing bookings remain valid

---

**Status:** PHASE 2 Complete ✅  
**Next:** PHASE 3 - Slot Generation Logic Fix
