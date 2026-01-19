# API Endpoint Inventory

This document provides a comprehensive list of all API endpoints in the backend project, including HTTP methods, paths, controllers, database tables used, and authentication requirements.

**Base URL:** `/api`

---

## Authentication Routes (`/api/auth`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| POST | `/api/auth/login` | Login handler | `profiles` | None (rate limited: 5/15min) |
| GET | `/api/auth/google` | Google OAuth initiation | None | None |
| GET | `/api/auth/google/callback` | Google OAuth callback | `profiles` | None |
| POST | `/api/auth/logout` | Logout handler | None | None |
| GET | `/api/auth/me` | Get current user | `profiles` | `authenticate` |

---

## Profile Routes (`/api/profiles`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/profiles/me` | Get own profile | `profiles` | `authenticate` |
| PUT | `/api/profiles/me` | Update own profile | `profiles` | `authenticate` |

---

## Trainer Routes (`/api/trainers`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/trainers` | List all active trainers | `trainers`, `profiles` | None (public) |
| GET | `/api/trainers/active` | List active trainers | `trainers`, `profiles` | None (public) |
| GET | `/api/trainers/:id` | Get trainer by ID | `trainers`, `profiles` | None (public) |

---

## Slot Routes (`/api/slots`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/slots` | List slots with filters | `slots`, `trainers`, `profiles`, `slot_vehicle_capacity`, `vehicles`, `bookings` | None (public) |
| GET | `/api/slots/date/:date` | Get slots by date | `slots`, `trainers`, `profiles`, `slot_vehicle_capacity`, `vehicles`, `bookings` | None (public) |
| GET | `/api/slots/range` | Get slots by date range | `slots`, `trainers`, `profiles` | None (public) |
| GET | `/api/slots/available` | Get available slots | `slots`, `trainers`, `profiles` | None (public) |
| GET | `/api/slots/:id` | Get slot by ID | `slots`, `trainers`, `profiles`, `slot_vehicle_capacity`, `vehicles`, `bookings` | None (public) |
| POST | `/api/slots` | Create slot | `slots`, `slot_vehicle_capacity`, `vehicles` | `authenticate`, `admin/superadmin` |
| PUT | `/api/slots/:id` | Update slot | `slots` | `authenticate`, `admin/superadmin` |
| PUT | `/api/slots/:id/trainer` | Update slot trainer | `slots`, `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| PUT | `/api/slots/:id/status` | Update slot status | `slots` | `authenticate`, `admin/superadmin` |
| PUT | `/api/slots/:id/toggle` | Toggle slot enable/disable | `slots` | `authenticate`, `admin/superadmin` |
| PUT | `/api/slots/:id/vehicle-capacity` | Update vehicle capacity for slot | `slots`, `slot_vehicle_capacity`, `vehicles`, `bookings`, `admin_audit_log` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/slots/:id` | Delete slot | `slots` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/slots/date/:date` | Delete slots by date | `slots` | `authenticate`, `admin/superadmin` |
| POST | `/api/slots/generate` | Generate daily slots | `slots`, `slot_vehicle_capacity`, `vehicles` | `authenticate`, `admin/superadmin` |
| POST | `/api/slots/generate-daily` | Generate daily slots (legacy) | `slots`, `slot_vehicle_capacity`, `vehicles` | `authenticate`, `admin/superadmin` |
| GET | `/api/slots/next-available-date` | Get next available date | `slots` | `authenticate`, `admin/superadmin` |
| POST | `/api/slots/update-visibility` | Update slot visibility | `slots` | `authenticate`, `admin/superadmin` |
| POST | `/api/slots/ensure-daily` | Ensure daily slots exist | `slots` | None (public, for cron) |

---

## Booking Routes (`/api/bookings`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| POST | `/api/bookings` | Create booking | `student_recognition`, `student_entitlements`, `profiles`, `slots`, `trainers`, `vehicles`, `bookings`, `slot_vehicle_capacity` | `authenticate` |
| GET | `/api/bookings/my-bookings` | Get user's bookings | `bookings`, `slots`, `trainers`, `profiles`, `vehicles` | `authenticate` |
| PUT | `/api/bookings/:id/cancel` | Cancel booking | `profiles`, `bookings`, `slots`, `admin_audit_log` | `authenticate` |

---

## Admin Routes (`/api/admin`)

**Note:** All routes require `authenticate` and `authorize('admin', 'superadmin')` middleware.

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/admin/bookings` | List all bookings | `bookings`, `slots`, `profiles`, `trainers` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/users` | List all users | `profiles`, `bookings` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/customers` | List customers | `profiles`, `bookings` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/customers/export` | Export customers (CSV/JSON) | `profiles` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/dashboard` | Get dashboard stats | `bookings`, `slots`, `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/stats` | Get dashboard stats (alias) | `bookings`, `slots`, `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/trainers` | List all trainers | `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| POST | `/api/admin/trainers` | Create trainer | `profiles`, `trainers` | `authenticate`, `admin/superadmin` |
| PUT | `/api/admin/trainers/:id` | Update trainer | `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/admin/trainers/:id` | Delete trainer | `trainers`, `bookings` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/slots` | List all slots | `slots`, `trainers`, `profiles` | `authenticate`, `admin/superadmin` |
| POST | `/api/admin/slots` | Create slot | `slots` | `authenticate`, `admin/superadmin` |
| PUT | `/api/admin/slots/:id` | Update slot | `slots` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/admin/slots/:id` | Delete slot | `slots`, `bookings` | `authenticate`, `admin/superadmin` |
| GET | `/api/admin/settings` | Get settings | `settings` | `authenticate`, `admin/superadmin` |
| PUT | `/api/admin/settings` | Update settings | `settings` | `authenticate`, `admin/superadmin` |
| PUT | `/api/admin/bookings/:id/status` | Update booking status | `bookings` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/admin/bookings/:id` | Delete booking | `bookings` | `authenticate`, `admin/superadmin` |
| POST | `/api/admin/users` | Create user | `profiles` | `authenticate`, `superadmin only` |
| PUT | `/api/admin/users/:id` | Update user | `profiles`, `audit_logs` | `authenticate`, `admin/superadmin` |
| PUT | `/api/admin/users/:id/role` | Update user role | `profiles`, `audit_logs` | `authenticate`, `superadmin only` |
| DELETE | `/api/admin/users/:id` | Delete user | `profiles`, `audit_logs` | `authenticate`, `superadmin only` |
| GET | `/api/admin/audit-logs` | Get audit logs | `admin_audit_log`, `profiles` | `authenticate`, `admin/superadmin` |

---

## Admin Management Routes (`/api/admin-management`)

**Note:** All routes require `authenticate` middleware. Specific routes require `authorizeAdmin` with roles.

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| POST | `/api/admin-management/create` | Create admin | `profiles`, `admins` | `authenticate`, `SUPER_ADMIN` |
| GET | `/api/admin-management/list` | List all admins | `admins`, `profiles` | `authenticate`, `SUPER_ADMIN` |
| GET | `/api/admin-management/:id` | Get admin by ID | `admins`, `profiles` | `authenticate`, `ADMIN/SUPER_ADMIN` |
| PUT | `/api/admin-management/update/:id` | Update admin | `admins`, `profiles` | `authenticate`, `SUPER_ADMIN` |
| PUT | `/api/admin-management/change-password` | Change own password | `admins`, `profiles` | `authenticate`, `ADMIN/SUPER_ADMIN` |
| PUT | `/api/admin-management/reset-password/:id` | Reset admin password | `admins` | `authenticate`, `SUPER_ADMIN` |
| DELETE | `/api/admin-management/delete/:id` | Delete admin | `admins`, `profiles` | `authenticate`, `SUPER_ADMIN` |

---

## Rating Routes (`/api/ratings`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| POST | `/api/ratings` | Submit rating | `ratings`, `bookings`, `slots`, `trainers` | `authenticate` |
| GET | `/api/ratings/trainer/:trainerId` | Get ratings for trainer | `ratings` | None (public) |

---

## Recognition Routes (`/api/recognition`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| POST | `/api/recognition` | Submit student recognition | `student_recognition` | `authenticate` |
| GET | `/api/recognition/status` | Get recognition status | `student_recognition` | `authenticate` |
| PUT | `/api/recognition/:id/approve` | Approve recognition | `student_recognition` | `authenticate`, `admin/superadmin` |
| PUT | `/api/recognition/:id/reject` | Reject recognition | `student_recognition` | `authenticate`, `admin/superadmin` |

---

## Settings Routes (`/api/settings`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/settings` | Get all settings (public) | `settings` | None (public) |
| GET | `/api/settings/all` | Get all settings with metadata | `settings` | `authenticate`, `admin/superadmin` |
| GET | `/api/settings/:key` | Get single setting | `settings` | None (public) |
| PUT | `/api/settings/:key` | Update single setting | `settings` | `authenticate`, `admin/superadmin` |
| PUT | `/api/settings` | Update multiple settings | `settings` | `authenticate`, `admin/superadmin` |

---

## Vehicle Routes (`/api/vehicles`)

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/api/vehicles` | List vehicles | `vehicles` | None (public) |
| GET | `/api/vehicles/:id` | Get vehicle by ID | `vehicles` | None (public) |
| POST | `/api/vehicles` | Create vehicle | `vehicles` | `authenticate`, `admin/superadmin` |
| PUT | `/api/vehicles/:id` | Update vehicle | `vehicles` | `authenticate`, `admin/superadmin` |
| DELETE | `/api/vehicles/:id` | Delete vehicle | `vehicles`, `bookings` | `authenticate`, `admin/superadmin` |

---

## Other Endpoints

| Method | Endpoint | Controller | Tables Used | Auth |
|--------|----------|------------|-------------|------|
| GET | `/health` | Health check | None | None (public) |
| GET | `/api/events` | Server-Sent Events stream | None | None (public) |

---

## Database Tables Reference

The following tables are used across the API endpoints:

- **`admins`** - Admin accounts (separate from profiles)
- **`admin_audit_log`** - Audit trail for admin actions
- **`audit_logs`** - General audit logs (legacy)
- **`bookings`** - Booking records
- **`profiles`** - User profiles (customers, trainers, admins)
- **`ratings`** - Trainer ratings by users
- **`settings`** - Application settings
- **`slots`** - Time slots for training sessions
- **`slot_vehicle_capacity`** - Vehicle-specific capacity per slot
- **`student_entitlements`** - Student booking entitlements
- **`student_recognition`** - Student recognition/invoice verification
- **`trainers`** - Trainer profiles
- **`vehicles`** - Vehicle types (electric, petrol, bike, etc.)

---

## Authentication Types

1. **None** - Public endpoint, no authentication required
2. **`authenticate`** - Requires valid JWT token (user must be logged in)
3. **`authenticate` + `admin/superadmin`** - Requires authentication AND admin/superadmin role from `profiles.role`
4. **`authenticate` + `SUPER_ADMIN`** - Requires authentication AND SUPER_ADMIN role from `admins.role`
5. **`authenticate` + `ADMIN/SUPER_ADMIN`** - Requires authentication AND ADMIN or SUPER_ADMIN role from `admins.role`

---

## Notes

- Rate limiting is applied to most endpoints (see `server.js` for details)
- Some endpoints have additional validation beyond authentication (e.g., phone number matching, booking eligibility)
- The admin management routes use a separate `admins` table with its own role system
- Most admin routes check both `profiles.role` and `admins.role` for authorization
- Audit logging is implemented for admin actions on bookings, slots, vehicles, and admin management

---

**Generated:** 2025-01-27
**Total Endpoints:** 80+
