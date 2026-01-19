# Admin Management API Documentation

**Base URL:** `/api/admin-management`  
**Authentication:** Required (JWT token)  
**Authorization:** Role-based (SUPER_ADMIN or ADMIN)

---

## ENDPOINTS

### 1. Create Admin

**POST** `/api/admin-management/create`

**Authorization:** SUPER_ADMIN only

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

**Error Responses:**
- `409 Conflict` - Admin account already exists for email
- `403 Forbidden` - Only SUPER_ADMIN can create admins
- `400 Bad Request` - Validation errors

---

### 2. List Admins

**GET** `/api/admin-management/list`

**Authorization:** SUPER_ADMIN only

**Query Parameters:**
- `role` (optional) - Filter by role: `ADMIN` or `SUPER_ADMIN`
- `is_active` (optional) - Filter by status: `true` or `false`
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

---

### 3. Get Admin Details

**GET** `/api/admin-management/:id`

**Authorization:** 
- SUPER_ADMIN: Can view any admin
- ADMIN: Can only view own profile

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

---

### 4. Update Admin

**PUT** `/api/admin-management/update/:id`

**Authorization:** SUPER_ADMIN only

**Request Body (all fields optional):**
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

**Error Responses:**
- `400 Bad Request` - Cannot deactivate/change role of own account
- `404 Not Found` - Admin not found
- `409 Conflict` - Email already exists

---

### 5. Reset Password

**PUT** `/api/admin-management/reset-password/:id`

**Authorization:** SUPER_ADMIN only

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

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

### 6. Delete Admin

**DELETE** `/api/admin-management/delete/:id`

**Authorization:** SUPER_ADMIN only

**Response (200 OK):**
```json
{
  "message": "Admin deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Cannot delete own account
- `404 Not Found` - Admin not found

---

## DATABASE SCHEMA

### admins Table

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

---

## SECURITY

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Role-based authorization middleware
- ✅ Self-protection (cannot delete/deactivate own account)
- ✅ Audit logging for all actions
- ✅ Account locking support
- ✅ Input validation

---

## MIGRATION

Run migration:
```bash
node backend/apply_migration.js supabase/migrations/20260125000003_create_admins_table.sql
```

---

**END OF API DOCUMENTATION**
