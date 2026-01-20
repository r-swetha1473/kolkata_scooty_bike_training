# Password Management API Documentation

**Base URL:** `/api/admin-management`  
**Authentication:** Required (JWT token)  
**Authorization:** Role-based (ADMIN or SUPER_ADMIN)

---

## ENDPOINTS

### 1. Change Password (Own Account)

**PUT** `/api/admin-management/change-password`

**Authorization:** Any logged-in admin (ADMIN or SUPER_ADMIN)

**Description:** Allows a logged-in admin to change their own password. Requires old password verification.

**Request Body:**
```json
{
  "old_password": "CurrentPassword123",
  "new_password": "NewSecurePassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `INVALID_OLD_PASSWORD` | Old password is incorrect |
| 403 | `ADMIN_ACCOUNT_INACTIVE` | Admin account is inactive |
| 403 | `ADMIN_ACCOUNT_LOCKED` | Admin account is locked |
| 404 | `ADMIN_ACCOUNT_NOT_FOUND` | Admin account not found |
| 400 | Validation Error | Password requirements not met or same password |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Must be different from old password

**Features:**
- ✅ Validates old password before allowing change
- ✅ Resets failed login attempts to 0
- ✅ Unlocks account if locked
- ✅ Logs audit trail
- ✅ Uses database transaction for safety

---

### 2. Reset Password (Any Admin)

**PUT** `/api/admin-management/reset-password/:id`

**Authorization:** SUPER_ADMIN only

**Description:** Allows SUPER_ADMIN to reset any admin's password without requiring the old password.

**Path Parameters:**
- `id` (UUID) - Admin ID whose password to reset

**Request Body:**
```json
{
  "new_password": "NewSecurePassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully"
}
```

**Error Responses:**

| Status | Error Code | Description |
|--------|------------|-------------|
| 404 | `ADMIN_NOT_FOUND` | Admin not found |
| 403 | `INSUFFICIENT_PERMISSIONS` | Only SUPER_ADMIN can reset passwords |
| 400 | Validation Error | Password requirements not met |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

**Features:**
- ✅ No old password required (admin override)
- ✅ Resets failed login attempts to 0
- ✅ Unlocks account if locked
- ✅ Logs audit trail with resetter information
- ✅ Uses database transaction for safety

---

## USAGE EXAMPLES

### Example 1: Change Own Password

```bash
curl -X PUT https://kolkata-scooty-bike-training-1ild.onrender.com/api/admin-management/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "CurrentPassword123",
    "new_password": "NewSecurePassword456"
  }'
```

**Success Response:**
```json
{
  "message": "Password changed successfully"
}
```

**Error Response (Wrong Old Password):**
```json
{
  "error": "Old password is incorrect",
  "errorCode": "INVALID_OLD_PASSWORD",
  "status": 401
}
```

---

### Example 2: Reset Admin Password (SUPER_ADMIN)

```bash
curl -X PUT https://kolkata-scooty-bike-training-1ild.onrender.com/api/admin-management/reset-password/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_password": "NewSecurePassword456"
  }'
```

**Success Response:**
```json
{
  "message": "Password reset successfully"
}
```

---

## SECURITY FEATURES

### Password Hashing
- Uses bcrypt with 10 rounds
- Passwords never stored in plain text
- Secure password comparison

### Authorization
- Change password: Any logged-in admin
- Reset password: SUPER_ADMIN only

### Account Protection
- Checks account is active
- Checks account is not locked
- Unlocks account on password change/reset

### Audit Logging
- All password operations logged
- Tracks who changed/reset password
- Includes timestamp and details

---

## ERROR HANDLING

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "errorCode": "ERROR_CODE",
  "status": 400
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| `INVALID_OLD_PASSWORD` | Old password is incorrect |
| `ADMIN_ACCOUNT_NOT_FOUND` | Admin account not found |
| `ADMIN_ACCOUNT_INACTIVE` | Admin account is inactive |
| `ADMIN_ACCOUNT_LOCKED` | Admin account is locked |
| `ADMIN_NOT_FOUND` | Admin not found (for reset) |
| `INSUFFICIENT_PERMISSIONS` | Not authorized |

---

## DATABASE

### admins Table

Uses existing `admins` table columns:
- `password_hash` - Bcrypt hashed password
- `is_active` - Account active status
- `failed_login_attempts` - Failed login counter
- `locked_until` - Account lock timestamp

**No schema changes required.**

---

## IMPLEMENTATION NOTES

### Change Password Flow

1. Authenticate user (JWT token)
2. Authorize admin account exists
3. Validate request body
4. Check account status (active, not locked)
5. Verify old password
6. Hash new password
7. Update password in database
8. Reset failed login attempts
9. Unlock account
10. Log audit trail
11. Return success

### Reset Password Flow

1. Authenticate user (JWT token)
2. Authorize SUPER_ADMIN role
3. Validate request body
4. Check admin exists
5. Hash new password
6. Update password in database
7. Reset failed login attempts
8. Unlock account
9. Log audit trail
10. Return success

---

**END OF API DOCUMENTATION**
