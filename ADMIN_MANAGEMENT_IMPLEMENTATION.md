# Admin and Super Admin Management Implementation

**Date:** 2026-01-25  
**Status:** ✅ Complete  
**Goal:** Implement full CRUD operations for Admin and Super Admin management with role-based access control

---

## EXECUTIVE SUMMARY

Implemented a comprehensive Admin and Super Admin management system with:
- ✅ Separate `admins` table with roles ADMIN and SUPER_ADMIN
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ Password reset functionality (SUPER_ADMIN only)
- ✅ Role-based middleware authorization
- ✅ Secure password hashing with bcrypt
- ✅ Audit logging for all admin actions
- ✅ Self-protection (cannot delete/deactivate own account)

**Files Created:** 3  
**Files Modified:** 4  
**Database:** New `admins` table

---

## DATABASE SCHEMA

### PostgreSQL Table: `admins`

```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPER_ADMIN')) DEFAULT 'ADMIN',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Features:**
- Links to `profiles` table via `profile_id` (one-to-one relationship)
- Roles: `ADMIN` or `SUPER_ADMIN`
- Password stored as bcrypt hash
- Account locking support (`failed_login_attempts`, `locked_until`)
- Tracks creator (`created_by`)
- Automatic `updated_at` trigger

**Indexes:**
- `idx_admins_profile_id` - Fast profile lookups
- `idx_admins_role` - Fast role-based queries
- `idx_admins_is_active` - Fast active admin queries
- `idx_admins_created_by` - Fast creator lookups

**Helper Function:**
- `can_admin_perform_action(p_admin_id UUID, p_required_role TEXT)` - Checks admin permissions

---

## API ENDPOINTS

### Base Path: `/api/admin-management`

All endpoints require authentication (`authenticate` middleware).

### 1. POST `/api/admin-management/create`
**Create a new admin (SUPER_ADMIN only)**

**Request Body:**
```json
{
  "email": "admin@example.com",
  "full_name": "Admin Name",
  "password": "SecurePassword123",
  "role": "ADMIN",
  "phone": "9876543210"
}
```

**Response (201 Created):**
```json
{
  "message": "Admin created successfully",
  "admin": {
    "id": "uuid",
    "role": "ADMIN",
    "is_active": true,
    "created_at": "2026-01-25T10:00:00Z",
    "profile_id": "uuid",
    "email": "admin@example.com",
    "full_name": "Admin Name",
    "phone": "9876543210"
  }
}
```

**Features:**
- Creates profile if doesn't exist
- Links admin account to profile
- Hashes password with bcrypt (10 rounds)
- Logs audit trail
- Prevents duplicate admin accounts

**Authorization:** SUPER_ADMIN only

---

### 2. GET `/api/admin-management/list`
**List all admins (SUPER_ADMIN only)**

**Query Parameters:**
- `role` (optional) - Filter by role: `ADMIN` or `SUPER_ADMIN`
- `is_active` (optional) - Filter by active status: `true` or `false`
- `search` (optional) - Search by email, name, or phone

**Response (200 OK):**
```json
{
  "count": 2,
  "admins": [
    {
      "id": "uuid",
      "role": "SUPER_ADMIN",
      "is_active": true,
      "last_login_at": "2026-01-25T09:00:00Z",
      "failed_login_attempts": 0,
      "locked_until": null,
      "created_at": "2026-01-25T08:00:00Z",
      "profile_id": "uuid",
      "email": "superadmin@example.com",
      "full_name": "Super Admin",
      "phone": "9876543210",
      "created_by_email": null,
      "created_by_name": null
    }
  ]
}
```

**Features:**
- Returns all admins with profile details
- Includes creator information
- Filters by role, status, and search term
- Never returns password_hash

**Authorization:** SUPER_ADMIN only

---

### 3. GET `/api/admin-management/:id`
**Get admin details by ID**

**Response (200 OK):**
```json
{
  "id": "uuid",
  "role": "ADMIN",
  "is_active": true,
  "last_login_at": "2026-01-25T09:00:00Z",
  "failed_login_attempts": 0,
  "locked_until": null,
  "created_at": "2026-01-25T08:00:00Z",
  "profile_id": "uuid",
  "email": "admin@example.com",
  "full_name": "Admin Name",
  "phone": "9876543210",
  "created_by_email": "superadmin@example.com",
  "created_by_name": "Super Admin"
}
```

**Features:**
- SUPER_ADMIN can view any admin
- ADMIN can only view themselves
- Returns full admin and profile details

**Authorization:** SUPER_ADMIN (any admin) or ADMIN (own profile only)

---

### 4. PUT `/api/admin-management/update/:id`
**Update admin details (SUPER_ADMIN only)**

**Request Body:**
```json
{
  "full_name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "9876543210",
  "is_active": true,
  "role": "ADMIN"
}
```

**Response (200 OK):**
```json
{
  "message": "Admin updated successfully",
  "admin": {
    "id": "uuid",
    "role": "ADMIN",
    "is_active": true,
    "email": "newemail@example.com",
    "full_name": "Updated Name",
    "phone": "9876543210"
  }
}
```

**Features:**
- Updates both `admins` and `profiles` tables
- Prevents self-deactivation
- Prevents self-role-change
- Logs audit trail with before/after values
- Validates email uniqueness

**Authorization:** SUPER_ADMIN only

---

### 5. PUT `/api/admin-management/reset-password/:id`
**Reset admin password (SUPER_ADMIN only)**

**Request Body:**
```json
{
  "new_password": "NewSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully"
}
```

**Features:**
- Resets password hash
- Resets failed login attempts
- Unlocks account (`locked_until = NULL`)
- Logs audit trail
- Password validation: min 8 chars, uppercase, lowercase, number

**Authorization:** SUPER_ADMIN only

---

### 6. DELETE `/api/admin-management/delete/:id`
**Delete admin (SUPER_ADMIN only)**

**Response (200 OK):**
```json
{
  "message": "Admin deleted successfully"
}
```

**Features:**
- Deletes admin account
- Profile cascade deleted if no other references
- Prevents self-deletion
- Logs audit trail with before value

**Authorization:** SUPER_ADMIN only

---

## MIDDLEWARE AUTHORIZATION

### Enhanced `authorizeAdmin` Middleware

**File:** `backend/middleware/auth.js`

**Function:** `authorizeAdmin(...adminRoles)`

**Features:**
- Checks `admins` table for admin account
- Validates `is_active` status
- Checks account lock status (`locked_until`)
- Validates role permissions
- Falls back to `profiles.role` if `admins` table doesn't exist (backward compatibility)
- Attaches `req.user.adminRole` and `req.user.adminId` to request

**Usage:**
```javascript
router.post('/create', authorizeAdmin('SUPER_ADMIN'), handler);
router.get('/list', authorizeAdmin('SUPER_ADMIN'), handler);
router.put('/update/:id', authorizeAdmin('SUPER_ADMIN'), handler);
router.put('/reset-password/:id', authorizeAdmin('SUPER_ADMIN'), handler);
router.delete('/delete/:id', authorizeAdmin('SUPER_ADMIN'), handler);
```

---

## VALIDATION

### Validators

**File:** `backend/validators/adminManagement.validator.js`

**Validators:**
1. `validateAdminCreation` - Email, name, password (min 8 chars, uppercase, lowercase, number), role
2. `validateAdminUpdate` - Optional fields: name, email, phone, is_active, role
3. `validatePasswordReset` - New password validation

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## SECURITY FEATURES

### 1. Password Hashing
- Uses `bcrypt` with 10 rounds
- Passwords never stored in plain text
- Password hash never returned in API responses

### 2. Role-Based Access Control
- SUPER_ADMIN: Full CRUD operations
- ADMIN: View own profile only
- Self-protection: Cannot delete/deactivate own account

### 3. Account Locking
- Tracks `failed_login_attempts`
- Supports `locked_until` timestamp
- Password reset unlocks account

### 4. Audit Logging
- All admin actions logged to `admin_audit_log`
- Tracks before/after values
- Includes creator information

---

## FILES CREATED

1. **`supabase/migrations/20260125000003_create_admins_table.sql`**
   - Creates `admins` table
   - Creates indexes
   - Creates helper function
   - Adds triggers

2. **`backend/validators/adminManagement.validator.js`**
   - Admin creation validation
   - Admin update validation
   - Password reset validation

3. **`backend/routes/adminManagement.js`**
   - All CRUD endpoints
   - Password reset endpoint
   - Role-based authorization
   - Audit logging

---

## FILES MODIFIED

1. **`backend/middleware/auth.js`**
   - Added `authorizeAdmin()` function
   - Enhanced authorization for admin management routes

2. **`backend/server.js`**
   - Added `/api/admin-management` route
   - Applied rate limiting

3. **`backend/validators/index.js`**
   - Exported admin management validators

---

## USAGE EXAMPLES

### Create Admin (SUPER_ADMIN only)

```bash
curl -X POST http://localhost:3000/api/admin-management/create \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "full_name": "Admin User",
    "password": "SecurePass123",
    "role": "ADMIN",
    "phone": "9876543210"
  }'
```

### List All Admins

```bash
curl -X GET "http://localhost:3000/api/admin-management/list?role=ADMIN&is_active=true" \
  -H "Authorization: Bearer <superadmin_token>"
```

### Update Admin

```bash
curl -X PUT http://localhost:3000/api/admin-management/update/<admin_id> \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Name",
    "is_active": true
  }'
```

### Reset Password

```bash
curl -X PUT http://localhost:3000/api/admin-management/reset-password/<admin_id> \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_password": "NewSecurePass123"
  }'
```

### Delete Admin

```bash
curl -X DELETE http://localhost:3000/api/admin-management/delete/<admin_id> \
  -H "Authorization: Bearer <superadmin_token>"
```

---

## MIGRATION INSTRUCTIONS

### Step 1: Run Migration

```bash
# Navigate to project root
cd d:\Anna_Swetha\OWN_PROJECTS\project\biketraining

# Run migration
node backend/apply_migration.js supabase/migrations/20260125000003_create_admins_table.sql
```

### Step 2: Create First Super Admin

**Option A: Using existing create_admin.js script**
```bash
cd backend
node create_admin.js superadmin@example.com SuperAdminPass123 superadmin
```

**Option B: Using API (after creating superadmin via profiles table)**
```bash
# First, ensure superadmin exists in profiles table with password_hash
# Then create admin account via API
curl -X POST http://localhost:3000/api/admin-management/create \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@example.com",
    "full_name": "Super Admin",
    "password": "SuperAdminPass123",
    "role": "SUPER_ADMIN"
  }'
```

---

## PERMISSION MATRIX

| Action | ADMIN | SUPER_ADMIN |
|--------|-------|-------------|
| View own profile | ✅ | ✅ |
| View other admins | ❌ | ✅ |
| Create admin | ❌ | ✅ |
| Update admin | ❌ | ✅ |
| Reset password | ❌ | ✅ |
| Delete admin | ❌ | ✅ |
| Manage slots | ✅ | ✅ |
| View bookings | ✅ | ✅ |

---

## ERROR HANDLING

**Error Codes:**
- `ADMIN_ALREADY_EXISTS` (409) - Admin account already exists for email
- `ADMIN_NOT_FOUND` (404) - Admin not found
- `ADMIN_ACCOUNT_NOT_FOUND` (403) - Admin account not found in admins table
- `ADMIN_ACCOUNT_INACTIVE` (403) - Admin account is inactive
- `ADMIN_ACCOUNT_LOCKED` (403) - Admin account is locked
- `INSUFFICIENT_PERMISSIONS` (403) - Insufficient permissions
- `CANNOT_DELETE_SELF` (400) - Cannot delete own account
- `CANNOT_DEACTIVATE_SELF` (400) - Cannot deactivate own account
- `CANNOT_CHANGE_OWN_ROLE` (400) - Cannot change own role
- `DUPLICATE_EMAIL` (409) - Email already exists
- `DUPLICATE_ADMIN` (409) - Admin account already exists

---

## TESTING

### Test Cases

1. **Create Admin:**
   - ✅ SUPER_ADMIN can create ADMIN
   - ✅ SUPER_ADMIN can create SUPER_ADMIN
   - ❌ ADMIN cannot create admin
   - ❌ Duplicate email rejected

2. **List Admins:**
   - ✅ SUPER_ADMIN can list all admins
   - ❌ ADMIN cannot list admins

3. **Update Admin:**
   - ✅ SUPER_ADMIN can update any admin
   - ❌ ADMIN cannot update admin
   - ❌ Cannot deactivate self
   - ❌ Cannot change own role

4. **Reset Password:**
   - ✅ SUPER_ADMIN can reset any password
   - ❌ ADMIN cannot reset password

5. **Delete Admin:**
   - ✅ SUPER_ADMIN can delete admin
   - ❌ Cannot delete self

---

## INTEGRATION WITH EXISTING SYSTEM

### Backward Compatibility

The implementation maintains backward compatibility:
- Existing `profiles` table with `role` column still works
- `authorizeAdmin()` falls back to `profiles.role` if `admins` table doesn't exist
- Existing admin login via `profiles.password_hash` still works

### Migration Path

1. **Phase 1:** Create `admins` table (migration)
2. **Phase 2:** Migrate existing admins from `profiles` to `admins` table (optional script)
3. **Phase 3:** Update login to check `admins` table first (optional enhancement)

---

## NEXT STEPS

1. ✅ **Database Migration** - Run migration to create `admins` table
2. ✅ **Create First Super Admin** - Use API or script
3. ⏸️ **Optional:** Migrate existing admins from `profiles` to `admins` table
4. ⏸️ **Optional:** Update login route to check `admins` table first
5. ⏸️ **Optional:** Add admin UI component for managing admins

---

**END OF ADMIN MANAGEMENT IMPLEMENTATION**
