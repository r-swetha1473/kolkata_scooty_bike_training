# Admin Panel Setup Guide

## Overview

This guide explains how to set up and use the admin panel for the Kolkata Scotty bike training booking system.

## Database Setup

### 1. Apply Migrations

The database schema has been automatically created with:
- Profiles table (users with roles)
- Trainers table
- Slots table
- Bookings table
- Audit logs table
- Settings table

All tables have Row Level Security (RLS) enabled with appropriate policies.

### 2. Seed Data

Demo data has been inserted including:
- 2 admin users (admin, superadmin)
- 3 customers
- 3 trainers with profiles
- 63 time slots (7 days × 9 slots per day)
- System settings

## Admin Users

### Default Admin Accounts

Two admin accounts are available:

**Admin Account:**
- Email: `admin@kolkatascotty.com`
- Role: `admin`
- Can manage: trainers, slots, bookings, view users

**Superadmin Account:**
- Email: `superadmin@kolkatascotty.com`
- Role: `superadmin`
- Can manage: everything + create/delete users, change roles

### Setting Admin Passwords

Admin passwords must be set via backend authentication. The passwords are hashed using bcrypt.

To create an admin with password in the backend:

```javascript
const bcrypt = require('bcryptjs');
const password = 'your-secure-password';
const hash = await bcrypt.hash(password, 10);

// Update the profile with the hash
UPDATE profiles
SET password_hash = 'hash-value'
WHERE email = 'admin@kolkatascotty.com';
```

## Admin Panel Features

### 1. Dashboard (`/admin`)
- View total users
- View total bookings
- View active trainers
- View upcoming bookings

### 2. Trainers Management (`/admin/trainers`)

**Create Trainer:**
- Click "Add Trainer" button
- Fill in:
  - Full Name (required)
  - Email (required)
  - Phone (optional)
  - Bio (required)
  - Experience Years (required)
  - Specialization (comma-separated)
- Creates both a profile and trainer record

**Update Trainer:**
- Click "Edit" button on any trainer
- Modify trainer details
- Can update trainer info and profile info

**Toggle Active/Inactive:**
- Click "Activate" or "Deactivate" button
- Inactive trainers won't appear in customer booking flow

**Delete Trainer:**
- Click "Delete" button
- Blocked if trainer has existing bookings
- Error message explains foreign key constraint

### 3. Slots Management (`/admin/slots`)

**Create Slot:**
- Click "Create Slot" button
- Select trainer from dropdown
- Set start time (datetime-local input)
- Set end time (datetime-local input)
- Set capacity (number of concurrent bookings)
- Status automatically set to "available"

**Update Slot:**
- Edit button available (currently in development)
- Can modify times, capacity, and status

**Delete Slot:**
- Click "Delete" button
- Blocked if slot has existing bookings
- Clear error message returned

**Slot Statuses:**
- `available` - Open for booking
- `full` - Capacity reached
- `cancelled` - Cancelled by admin
- `completed` - Session finished

### 4. Bookings Management (`/admin/bookings`)

**View Bookings:**
- Lists all bookings with customer, trainer, and slot info
- Shows booking status
- Displays creation date

**Filter Bookings:**
- Filter by status (pending, confirmed, completed, cancelled)
- Filter by date range
- Refresh button to reload

**Update Booking Status:**
- Confirm pending bookings
- Complete confirmed bookings
- Cancel pending/confirmed bookings
- Status flow: pending → confirmed → completed

**Delete Booking:**
- Permanent deletion available
- Confirmation dialog shown
- No restrictions (can delete any status)

### 5. Users Management (`/admin/users`)

**View Users:**
- All admins can view users
- Shows name, email, phone, role, join date

**Change User Role (Superadmin Only):**
- Select new role from dropdown
- Available roles: customer, trainer, admin, superadmin
- Confirmation dialog shown

**Create User (Superadmin Only):**
- Currently available via API only
- Frontend UI can be added

**Delete User (Superadmin Only):**
- Currently available via API only
- Cannot delete own account
- Blocked if user has related data

### 6. Settings Management (`/admin/settings`)

**View Settings:**
- Business hours
- Booking configuration
- Pricing

**Update Settings:**
- Modify JSON values
- Changes tracked with updater ID

### 7. Audit Logs (`/admin/audit`)

**View Audit Trail:**
- Shows last 100 actions
- Includes user, action type, entity
- Shows old and new data
- Includes IP address and timestamp

## Frontend Booking Flow

### Customer View

**Booking Process:**
1. Customer visits `/booking`
2. Selects trainer
3. Views available slots (where `status = 'available'` and `booked_count < capacity`)
4. Books a slot
5. Backend increments `booked_count`
6. Creates booking record with `status = 'pending'`

**Slot Availability:**
- Only slots with `is_booked = false` appear
- Status automatically changes to `full` when `booked_count = capacity`

## API Authentication

### JWT Token Flow

1. Admin logs in via `/admin/login`
2. Backend validates credentials
3. JWT token returned (valid for 7 days)
4. Frontend stores token in localStorage
5. All admin API calls include: `Authorization: Bearer <token>`

### Middleware Protection

All admin routes protected by:
```javascript
router.use(authenticate);           // Validates JWT
router.use(authorize('admin', 'superadmin')); // Checks role
```

## Security Features

### Password Security
- Bcrypt hashing (cost factor: 10)
- Passwords never returned in API responses
- Only password hash stored in database

### Role-Based Access Control

**Customer:**
- View own bookings
- Create bookings
- Cancel own bookings

**Trainer:**
- View assigned bookings
- View own trainer profile
- Cannot modify slots

**Admin:**
- Full CRUD on trainers, slots, bookings
- View all users
- Cannot create users or change roles

**Superadmin:**
- All admin permissions
- Create users
- Delete users
- Change user roles

### Row Level Security

All tables have RLS policies:
- Customers see only their data
- Trainers see assigned bookings
- Admins see all data
- Policies use `auth.uid()` for user checks

## Foreign Key Handling

### Delete Protection

**Trainers:**
- Cannot delete if bookings exist
- Error: "Cannot delete trainer with existing bookings"
- HTTP 400 with clear message

**Slots:**
- Cannot delete if bookings exist
- Error: "Cannot delete slot with existing bookings"
- HTTP 400 with clear message

**Users:**
- Cannot delete if related data exists
- Error: "This user has related data that must be removed first"
- HTTP 400 with clear message

### Cascade Deletions

When allowed, deletes cascade:
- Delete profile → deletes trainer → deletes slots → deletes bookings
- Uses `ON DELETE CASCADE` in foreign keys

## Testing the Admin Panel

### 1. Setup Backend

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3000`

### 2. Setup Frontend

```bash
npm install
npm start
```

Frontend runs on `http://localhost:4200`

### 3. Access Admin Panel

1. Navigate to `http://localhost:4200/admin/login`
2. Enter admin credentials
3. Upon successful login, redirected to `/admin` dashboard

### 4. Test CRUD Operations

**Create a Trainer:**
- Go to `/admin/trainers`
- Click "Add Trainer"
- Fill form and submit
- Verify trainer appears in list

**Create a Slot:**
- Go to `/admin/slots`
- Click "Create Slot"
- Select trainer, set times, capacity
- Verify slot created

**Test Delete Protection:**
- Try to delete a trainer with bookings
- Verify error message appears
- Confirm booking must be removed first

**Update Booking Status:**
- Go to `/admin/bookings`
- Click "Confirm" on a pending booking
- Verify status changes to "confirmed"

### 5. Test Role Permissions

**Login as Admin:**
- Can view users but not change roles
- Cannot see user management actions

**Login as Superadmin:**
- Can view and change user roles
- Role dropdown appears in users table

## Troubleshooting

### Common Issues

**Cannot login:**
- Verify admin password_hash is set in database
- Check JWT_SECRET is set in backend .env
- Verify email matches exactly

**Token expired:**
- JWT tokens expire after 7 days
- Re-login to get new token

**Cannot delete trainer:**
- Check if trainer has bookings
- Delete bookings first
- Or set trainer as inactive instead

**RLS denies access:**
- Verify user role in profiles table
- Check RLS policies are enabled
- Ensure auth.uid() matches user ID

### Environment Variables

Backend `.env` must include:
```
DATABASE_URL=your-supabase-connection-string
JWT_SECRET=your-secure-secret-key
SESSION_SECRET=your-session-secret
FRONTEND_URL=http://localhost:4200
NODE_ENV=development
```

## API Documentation

Complete API documentation is available in `API_DOCUMENTATION.md`.

Key endpoints:
- `POST /api/auth/login` - Admin login
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/trainers` - List trainers
- `POST /api/admin/trainers` - Create trainer
- `PUT /api/admin/trainers/:id` - Update trainer
- `DELETE /api/admin/trainers/:id` - Delete trainer
- `GET /api/admin/slots` - List slots
- `POST /api/admin/slots` - Create slot
- `DELETE /api/admin/slots/:id` - Delete slot
- `GET /api/admin/bookings` - List bookings
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `DELETE /api/admin/bookings/:id` - Delete booking
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user (superadmin)
- `PUT /api/admin/users/:id/role` - Update role (superadmin)
- `DELETE /api/admin/users/:id` - Delete user (superadmin)

## Production Deployment

### Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Set NODE_ENV=production
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Review RLS policies
- [ ] Set up database backups
- [ ] Monitor audit logs
- [ ] Implement IP whitelisting (optional)

### Database Backups

Regular backups recommended:
- Daily automated backups
- Before major updates
- Before bulk deletions

### Monitoring

Monitor these metrics:
- Failed login attempts
- API error rates
- Database query performance
- Booking creation rate
- Slot utilization

## Support

For issues or questions:
1. Check `API_DOCUMENTATION.md`
2. Review this setup guide
3. Check audit logs for recent changes
4. Verify environment variables
5. Check database RLS policies
