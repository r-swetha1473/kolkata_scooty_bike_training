# Kolkata Scotty Admin API Documentation

## Overview

This document describes the admin API endpoints for the Kolkata Scotty bike training booking system. All admin endpoints require JWT authentication and appropriate role permissions.

## Authentication

### Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "admin@kolkatascotty.com",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@kolkatascotty.com",
    "full_name": "Admin User",
    "phone": "+91 98765 00001",
    "role": "admin",
    "created_at": "2025-11-01T00:00:00.000Z",
    "updated_at": "2025-11-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing email or password
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - User is not admin/superadmin

### Get Current User
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "admin@kolkatascotty.com",
  "full_name": "Admin User",
  "role": "admin"
}
```

## Admin Dashboard

### Get Statistics
```
GET /api/admin/stats
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "totalUsers": 150,
  "totalBookings": 320,
  "activeTrainers": 8,
  "upcomingBookings": 45
}
```

**Required Role:** admin, superadmin

## Trainers Management

### List All Trainers
```
GET /api/admin/trainers
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "trainer-uuid",
    "user_id": "user-uuid",
    "bio": "Expert bike trainer with 10+ years of experience...",
    "experience_years": 10,
    "specialization": ["Beginner Training", "Highway Riding"],
    "rating": 4.8,
    "total_sessions": 450,
    "is_active": true,
    "created_at": "2025-11-01T00:00:00.000Z",
    "updated_at": "2025-11-01T00:00:00.000Z",
    "profile": {
      "id": "user-uuid",
      "email": "trainer@example.com",
      "full_name": "John Doe",
      "phone": "+91 98765 12345"
    }
  }
]
```

### Create Trainer
```
POST /api/admin/trainers
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "newtrainer@example.com",
  "full_name": "Jane Smith",
  "phone": "+91 98765 54321",
  "bio": "Experienced motorcycle instructor...",
  "experience_years": 5,
  "specialization": ["Beginner Training", "Safety Training"]
}
```

**Response (201 Created):**
```json
{
  "id": "trainer-uuid",
  "user_id": "user-uuid",
  "bio": "Experienced motorcycle instructor...",
  "experience_years": 5,
  "specialization": ["Beginner Training", "Safety Training"],
  "is_active": true,
  "profile": {
    "id": "user-uuid"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Email already exists

### Update Trainer
```
PUT /api/admin/trainers/:id
Headers: Authorization: Bearer <token>
```

**Request Body (all fields optional):**
```json
{
  "bio": "Updated bio...",
  "experience_years": 11,
  "specialization": ["Beginner Training", "Highway Riding", "Advanced Skills"],
  "is_active": false,
  "full_name": "Updated Name",
  "phone": "+91 98765 11111"
}
```

**Response (200 OK):**
```json
{
  "id": "trainer-uuid",
  "user_id": "user-uuid",
  "bio": "Updated bio...",
  "experience_years": 11,
  "specialization": ["Beginner Training", "Highway Riding", "Advanced Skills"],
  "rating": 4.8,
  "total_sessions": 450,
  "is_active": false,
  "profile": {
    "id": "user-uuid",
    "email": "trainer@example.com",
    "full_name": "Updated Name",
    "phone": "+91 98765 11111"
  }
}
```

**Error Responses:**
- `400 Bad Request` - No fields to update
- `404 Not Found` - Trainer not found

### Delete Trainer
```
DELETE /api/admin/trainers/:id
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Trainer deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Trainer has existing bookings (includes message)
- `404 Not Found` - Trainer not found

## Slots Management

### List All Slots
```
GET /api/admin/slots
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "slot-uuid",
    "trainer_id": "trainer-uuid",
    "start_time": "2025-11-02T09:00:00.000Z",
    "end_time": "2025-11-02T10:00:00.000Z",
    "capacity": 3,
    "booked_count": 1,
    "status": "available",
    "trainer": {
      "id": "trainer-uuid",
      "profile": {
        "id": "user-uuid",
        "full_name": "John Doe",
        "email": "trainer@example.com"
      }
    }
  }
]
```

### Create Slot
```
POST /api/admin/slots
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "trainer_id": "trainer-uuid",
  "start_time": "2025-11-05T14:00:00.000Z",
  "end_time": "2025-11-05T15:00:00.000Z",
  "capacity": 3
}
```

**Response (201 Created):**
```json
{
  "id": "slot-uuid",
  "trainer_id": "trainer-uuid",
  "start_time": "2025-11-05T14:00:00.000Z",
  "end_time": "2025-11-05T15:00:00.000Z",
  "capacity": 3,
  "booked_count": 0,
  "status": "available",
  "created_at": "2025-11-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Slot already exists at this time

### Update Slot
```
PUT /api/admin/slots/:id
Headers: Authorization: Bearer <token>
```

**Request Body (all fields optional):**
```json
{
  "start_time": "2025-11-05T15:00:00.000Z",
  "end_time": "2025-11-05T16:00:00.000Z",
  "capacity": 5,
  "status": "cancelled"
}
```

**Response (200 OK):**
```json
{
  "id": "slot-uuid",
  "trainer_id": "trainer-uuid",
  "start_time": "2025-11-05T15:00:00.000Z",
  "end_time": "2025-11-05T16:00:00.000Z",
  "capacity": 5,
  "booked_count": 0,
  "status": "cancelled"
}
```

**Error Responses:**
- `400 Bad Request` - No fields to update
- `404 Not Found` - Slot not found

### Delete Slot
```
DELETE /api/admin/slots/:id
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Slot deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Slot has existing bookings (includes message)
- `404 Not Found` - Slot not found

## Bookings Management

### List All Bookings
```
GET /api/admin/bookings
Headers: Authorization: Bearer <token>
```

**Query Parameters (optional):**
- `status` - Filter by booking status
- `startDate` - Filter bookings from this date
- `endDate` - Filter bookings until this date

**Response (200 OK):**
```json
[
  {
    "id": "booking-uuid",
    "user_id": "user-uuid",
    "slot_id": "slot-uuid",
    "trainer_id": "trainer-uuid",
    "status": "confirmed",
    "notes": "First time learner",
    "created_at": "2025-11-01T00:00:00.000Z",
    "start_time": "2025-11-02T09:00:00.000Z",
    "end_time": "2025-11-02T10:00:00.000Z",
    "user_name": "Customer Name",
    "user_email": "customer@example.com",
    "trainer_name": "Trainer Name"
  }
]
```

### Update Booking Status
```
PUT /api/admin/bookings/:id/status
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "confirmed"
}
```

**Valid Status Values:**
- `pending`
- `confirmed`
- `completed`
- `cancelled`
- `no_show`

**Response (200 OK):**
```json
{
  "id": "booking-uuid",
  "user_id": "user-uuid",
  "slot_id": "slot-uuid",
  "trainer_id": "trainer-uuid",
  "status": "confirmed",
  "updated_at": "2025-11-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Status is required or invalid
- `404 Not Found` - Booking not found

### Delete Booking
```
DELETE /api/admin/bookings/:id
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Booking deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` - Booking not found

## Users Management

### List All Users
```
GET /api/admin/users
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "User Name",
    "phone": "+91 98765 12345",
    "role": "customer",
    "created_at": "2025-11-01T00:00:00.000Z"
  }
]
```

### Create User (Superadmin Only)
```
POST /api/admin/users
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "full_name": "New User",
  "phone": "+91 98765 99999",
  "role": "admin"
}
```

**Valid Roles:**
- `customer`
- `trainer`
- `admin`
- `superadmin`

**Response (201 Created):**
```json
{
  "id": "user-uuid",
  "email": "newuser@example.com",
  "full_name": "New User",
  "phone": "+91 98765 99999",
  "role": "admin",
  "created_at": "2025-11-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or invalid role
- `403 Forbidden` - Only superadmins can create users
- `409 Conflict` - Email already exists

### Update User Role (Superadmin Only)
```
PUT /api/admin/users/:id/role
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "full_name": "User Name",
  "phone": "+91 98765 12345",
  "role": "admin",
  "created_at": "2025-11-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Role is required or invalid
- `403 Forbidden` - Only superadmins can change roles
- `404 Not Found` - User not found

### Delete User (Superadmin Only)
```
DELETE /api/admin/users/:id
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Cannot delete your own account or user has related data
- `403 Forbidden` - Only superadmins can delete users
- `404 Not Found` - User not found

## Audit Logs

### List Audit Logs
```
GET /api/admin/audit
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
[
  {
    "id": "log-uuid",
    "user_id": "user-uuid",
    "action": "CREATE",
    "entity_type": "booking",
    "entity_id": "entity-uuid",
    "old_data": null,
    "new_data": { "status": "confirmed" },
    "ip_address": "192.168.1.1",
    "created_at": "2025-11-01T00:00:00.000Z",
    "user": {
      "full_name": "Admin User",
      "email": "admin@example.com"
    }
  }
]
```

**Required Role:** admin, superadmin
**Limit:** 100 most recent logs

## Settings

### Get Settings
```
GET /api/admin/settings
Headers: Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "business_hours": {
    "value": {
      "monday": "09:00-20:00",
      "tuesday": "09:00-20:00",
      "wednesday": "09:00-20:00",
      "thursday": "09:00-20:00",
      "friday": "09:00-20:00",
      "saturday": "09:00-20:00",
      "sunday": "10:00-18:00"
    },
    "description": "Business operating hours",
    "updated_at": "2025-11-01T00:00:00.000Z",
    "updated_by": "admin-uuid"
  },
  "booking_settings": {
    "value": {
      "advance_booking_days": 30,
      "cancellation_hours": 24,
      "max_bookings_per_user": 5
    },
    "description": "Booking configuration",
    "updated_at": "2025-11-01T00:00:00.000Z"
  }
}
```

### Update Settings
```
PUT /api/admin/settings
Headers: Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "business_hours": {
    "value": {
      "monday": "08:00-21:00",
      "tuesday": "08:00-21:00"
    },
    "description": "Updated business hours"
  }
}
```

**Response (200 OK):**
```json
{
  "message": "Settings updated successfully"
}
```

## Error Handling

All endpoints return consistent error responses:

### Error Response Format:
```json
{
  "error": "Error message",
  "message": "Detailed error description (optional)"
}
```

### Common HTTP Status Codes:
- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `500 Internal Server Error` - Server error

## Authorization

### Role Permissions:

**Admin:**
- Manage trainers (create, read, update, delete)
- Manage slots (create, read, update, delete)
- Manage bookings (read, update, delete)
- View all users
- View audit logs
- Update settings
- View statistics

**Superadmin:**
- All admin permissions
- Create users
- Update user roles
- Delete users

## Rate Limiting

All API endpoints are rate-limited to:
- 100 requests per 15 minutes per IP address

Exceeding this limit will result in `429 Too Many Requests` response.

## Testing

### Test Credentials

**Admin:**
- Email: `admin@kolkatascotty.com`
- Password: Create via Supabase Auth dashboard

**Superadmin:**
- Email: `superadmin@kolkatascotty.com`
- Password: Create via Supabase Auth dashboard

### Sample Test Flow:

1. **Login as admin:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@kolkatascotty.com", "password": "admin123"}'
   ```

2. **Get statistics:**
   ```bash
   curl -X GET http://localhost:3000/api/admin/stats \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Create a trainer:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/trainers \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email": "trainer@example.com", "full_name": "Test Trainer", "bio": "Test bio", "experience_years": 5}'
   ```

4. **Create a slot:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/slots \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"trainer_id": "TRAINER_ID", "start_time": "2025-11-05T14:00:00Z", "end_time": "2025-11-05T15:00:00Z", "capacity": 3}'
   ```

5. **Update booking status:**
   ```bash
   curl -X PUT http://localhost:3000/api/admin/bookings/BOOKING_ID/status \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status": "confirmed"}'
   ```
