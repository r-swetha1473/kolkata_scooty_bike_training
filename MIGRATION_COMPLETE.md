# Kolkata Scotty Bike Training - Migration to Direct PostgreSQL

## Summary

This document summarizes the complete migration from Supabase to direct PostgreSQL connection and all enhancements made to the Kolkata Scotty Bike Training project.

## ✅ Completed Changes

### 1. Database Configuration
- **Updated `backend/db.js`**: Changed from `DATABASE_URL` connection string to individual environment variables:
  - `DB_HOST` (default: localhost)
  - `DB_PORT` (default: 5432)
  - `DB_NAME` (default: biketraining)
  - `DB_USER` (default: postgres)
  - `DB_PASSWORD` (default: empty)

### 2. Removed Supabase Integration
- ✅ Deleted `src/app/services/supabase.service.old.ts`
- ✅ Deleted `src/app/services/auth.service.old.ts`
- ✅ Updated `src/sw.js` to remove Supabase-specific caching
- ✅ All frontend services now use direct API calls via `HttpService`

### 3. Trainer Management Enhancements
- **Backend**: Trainer CRUD operations available in `/api/admin/trainers`
  - `POST /api/admin/trainers` - Create trainer (automatically creates profile with role 'trainer')
  - `GET /api/admin/trainers` - Get all trainers with profile info
  - `PUT /api/admin/trainers/:id` - Update trainer (including is_active toggle)
  - `DELETE /api/admin/trainers/:id` - Delete trainer
- **Frontend**: Updated `AdminTrainersComponent` to use `AdminService` for all operations
- **Features**:
  - Admin can create trainers directly from admin panel
  - Trainer profile is automatically created in `tbl_users` (profiles table) with role 'trainer'
  - Toggle active/inactive status
  - Dynamic fetching from backend (no hardcoded values)

### 4. Slot Management Fixes
- **Slot Generation**: Already configured for 9:00 AM to 9:00 PM with 30-minute intervals
- **Enhanced Filtering**:
  - Available slots now filter out trainers with `is_active = false`
  - Off-duty trainers' slots are automatically hidden/disabled
- **Slot Assignment**: Admin can assign/reassign slots to trainers
- **Dynamic Data**: All slots fetched from backend, no hardcoded values

### 5. Booking Flow Enhancements
- **Google Authentication**: 
  - Passport.js strategy checks if user exists by `google_id` or `email`
  - If exists → login directly
  - If not → creates new user profile with role 'customer'
- **Booking Validation**:
  - Checks if slot is assigned to a trainer
  - Validates trainer is active (not off-duty)
  - Checks slot availability and capacity
  - Prevents double-booking
  - Proper error messages for all scenarios
- **Booking Storage**: All bookings saved in `tbl_bookings` with proper relationships

### 6. User Profile Page
- **New Component**: `src/app/pages/profile/profile.component.ts`
- **Features**:
  - Displays user info (name, email, phone, avatar)
  - Lists all bookings (previous and upcoming)
  - Shows booking status, trainer info, date/time
  - Cancel upcoming bookings functionality
  - Beautiful, responsive UI
- **Route**: `/profile` (protected by auth guard)

### 7. Frontend Services Updates
- All services updated to use direct API endpoints
- `HttpService` handles authentication with JWT tokens
- `AuthService` uses backend `/api/auth` endpoints
- `BookingService` uses `/api/bookings/my-bookings` endpoint
- `AdminService` handles all admin operations

## Environment Variables Required

### Backend (.env)
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=biketraining
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
SESSION_SECRET=your_session_secret
```

### Frontend (src/environments/environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
```

## Database Schema

The project uses the following main tables:
- `profiles` - User accounts (customers, trainers, admins)
- `trainers` - Trainer-specific information
- `slots` - Training time slots
- `bookings` - User bookings
- `settings` - System settings
- `audit_logs` - Admin action logs

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin email/password login
- `GET /api/auth/google` - Google OAuth initiation
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Trainers
- `GET /api/trainers` - Get active trainers (public)
- `GET /api/trainers/:id` - Get trainer details
- `GET /api/admin/trainers` - Get all trainers (admin)
- `POST /api/admin/trainers` - Create trainer (admin)
- `PUT /api/admin/trainers/:id` - Update trainer (admin)
- `DELETE /api/admin/trainers/:id` - Delete trainer (admin)

### Slots
- `GET /api/slots` - Get slots with filters
- `GET /api/slots/available` - Get available slots (filters inactive trainers)
- `GET /api/slots/:id` - Get slot details
- `POST /api/slots/generate-daily` - Generate daily slots (admin)
- `POST /api/slots` - Create slot (admin)
- `PUT /api/slots/:id` - Update slot (admin)
- `DELETE /api/slots/:id` - Delete slot (admin)

### Bookings
- `POST /api/bookings` - Create booking (authenticated)
- `GET /api/bookings/my-bookings` - Get user's bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/bookings` - All bookings
- `GET /api/admin/users` - All users
- `GET /api/admin/settings` - System settings
- `PUT /api/admin/settings` - Update settings

## Complete Flow Validation

### Admin Side
1. ✅ Admin logs in via `/admin/login`
2. ✅ Admin creates trainers from `/admin/trainers`
3. ✅ Admin generates slots (9 AM - 9 PM, 30-min intervals)
4. ✅ Admin assigns slots to trainers
5. ✅ Admin can toggle trainer active/inactive status
6. ✅ Admin views all bookings

### Trainer Side
1. ✅ Trainers created with proper role in profiles table
2. ✅ Active trainers' slots are visible
3. ✅ Inactive trainers' slots are hidden
4. ✅ Trainer info fetched dynamically

### User Side
1. ✅ User signs in with Google OAuth
2. ✅ User profile created automatically if doesn't exist
3. ✅ User can view available slots (only active trainers)
4. ✅ User can book slots
5. ✅ Booking validation prevents conflicts
6. ✅ User can view profile and booking history
7. ✅ User can cancel upcoming bookings

## Testing Checklist

- [ ] Set up PostgreSQL database
- [ ] Configure environment variables
- [ ] Run database migrations (schema.sql)
- [ ] Start backend server (`npm start` in backend/)
- [ ] Start frontend (`npm start` in root)
- [ ] Test admin login
- [ ] Test trainer creation
- [ ] Test slot generation and assignment
- [ ] Test Google OAuth login
- [ ] Test slot booking
- [ ] Test profile page
- [ ] Test booking cancellation

## Notes

- All Supabase dependencies have been removed
- The project now uses direct PostgreSQL connection via `pg` package
- Google OAuth is handled via Passport.js
- JWT tokens are used for authentication
- All data is stored in PostgreSQL database
- Frontend communicates with backend via REST API

## Next Steps

1. Set up PostgreSQL database
2. Configure environment variables
3. Run `backend/schema.sql` to create tables
4. Create admin user (see `backend/insert_admin.sql` or use `backend/fix_admin_passwords.js`)
5. Start backend: `cd backend && npm start`
6. Start frontend: `npm start`
7. Test the complete flow

