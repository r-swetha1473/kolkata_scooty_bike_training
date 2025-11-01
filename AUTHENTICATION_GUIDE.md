# Authentication Guide - Kolkata Scotty

## Overview

This application uses **two separate authentication methods**:

1. **Google OAuth** - For regular users (customers) booking slots
2. **Email/Password** - For admin access via separate admin login page

## Authentication Flows

### For Regular Users (Customers)

**Purpose:** Book training slots

**Login Method:** Google OAuth

**Flow:**
```
1. Visit main site (/)
2. Click "Sign In" button (top right)
3. Redirects to Google OAuth
4. Login with Google account
5. Redirects back to /booking
6. User can now book slots
```

**Features:**
- Quick Google sign-in
- No password management
- Auto profile creation
- Access to booking system

**User Menu:**
- My Bookings
- Sign Out

### For Admins

**Purpose:** Manage system (bookings, slots, trainers, etc.)

**Login Method:** Email/Password

**Flow:**
```
1. Visit /admin/login directly
2. Enter admin email and password
3. Validates credentials
4. Checks user has admin/superadmin role
5. Redirects to /admin dashboard
6. Full admin panel access
```

**Features:**
- Separate admin login page
- Email/password authentication
- Role-based access control
- Protected admin routes

**Admin Access:**
- Dashboard with stats
- Manage bookings
- Manage slots
- Manage trainers
- Manage users (superadmin only)
- System settings
- Audit logs

## Setup Instructions

### 1. Configure Google OAuth (For Users)

**In Google Cloud Console:**

1. Go to https://console.cloud.google.com/
2. Create project or select existing
3. APIs & Services → Credentials
4. Create OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   ```
   https://cogzshqrbuzhvstvjpso.supabase.co/auth/v1/callback
   http://localhost:4200
   ```

**In Supabase Dashboard:**

1. Go to Authentication → Providers
2. Enable Google provider
3. Add Client ID and Client Secret
4. Save configuration

### 2. Create Admin Users (For Admins)

**Step 1: Create in Supabase Auth**

1. Go to Supabase Dashboard
2. Authentication → Users → Add User
3. Create admin user:
   - Email: `admin@kolkatascotty.com`
   - Password: `admin123` (change in production!)
   - Auto Confirm User: ✓ Yes
4. Copy the user ID from the created user

**Step 2: Link to Profile**

Run this SQL in Supabase SQL Editor:

```sql
-- Replace USER_ID_FROM_AUTH with the actual UUID from step 1
UPDATE profiles
SET id = 'USER_ID_FROM_AUTH'
WHERE email = 'admin@kolkatascotty.com';
```

**Step 3: Verify**

```sql
SELECT id, email, full_name, role
FROM profiles
WHERE email = 'admin@kolkatascotty.com';
```

Should return:
```
id: [UUID from Auth]
email: admin@kolkatascotty.com
full_name: Admin User
role: admin
```

### 3. Run Seed Data

**In Supabase SQL Editor:**

```sql
-- This will create demo data
-- Run the contents of supabase/seed.sql
```

**What it creates:**
- 2 Admin profiles (admin, superadmin)
- 3 Customer profiles
- 3 Trainers with specializations
- 63 Time slots (next 7 days)
- 1 Sample booking
- System settings

## Testing the Flows

### Test User Flow (Google OAuth)

```bash
# 1. Start app
npm start

# 2. Open http://localhost:4200

# 3. Click "Sign In" button
✓ Should redirect to Google

# 4. Login with Google
✓ Should redirect back to /booking

# 5. Check user menu (top right)
✓ Should show your name/avatar
✓ Should have "My Bookings" and "Sign Out"

# 6. Try to book a slot
✓ Should work without additional login
```

### Test Admin Flow (Email/Password)

```bash
# 1. Visit admin login directly
http://localhost:4200/admin/login

# 2. Enter credentials
Email: admin@kolkatascotty.com
Password: admin123

# 3. Click "Sign In"
✓ Should validate and redirect to /admin

# 4. Verify admin dashboard loads
✓ Should show stats and navigation

# 5. Try admin features
✓ Should access all admin pages
```

### Test Protected Routes

```bash
# 1. Sign out (if logged in)

# 2. Try to access /admin directly
http://localhost:4200/admin

✓ Should redirect to /admin/login
✓ Should NOT access admin panel

# 3. Login as admin
✓ Should then access /admin successfully
```

## Routes

### Public Routes (No Auth Required)
```
/           - Home page
/about      - About page
/courses    - Courses page
/trainers   - Trainers page
/contact    - Contact page
```

### User Routes (Google OAuth Required)
```
/booking    - Booking page (can access without login, but need to login to book)
```

### Admin Routes (Email/Password Required)
```
/admin/login              - Admin login page (public)
/admin                    - Admin dashboard (protected)
/admin/bookings           - Manage bookings (protected)
/admin/slots              - Manage slots (protected)
/admin/trainers           - Manage trainers (protected)
/admin/users              - Manage users (superadmin only)
/admin/settings           - System settings (protected)
/admin/audit              - Audit logs (protected)
```

## Security

### User Security (Google OAuth)
- OAuth 2.0 secure flow
- No password storage
- Auto session management
- Token-based authentication

### Admin Security (Email/Password)
- Password hashing by Supabase
- Separate login page
- Role verification on login
- Protected routes with guards
- Session-based access

### Role-Based Access Control

**Customer Role:**
```typescript
role: 'customer'
```
- Can book slots
- Can view own bookings
- Cannot access admin panel

**Trainer Role:**
```typescript
role: 'trainer'
```
- Can view assigned slots
- Can view assigned bookings
- Cannot access admin panel

**Admin Role:**
```typescript
role: 'admin'
```
- Full admin panel access
- Cannot manage users
- Cannot change roles

**Superadmin Role:**
```typescript
role: 'superadmin'
```
- All admin features
- Can manage users
- Can change roles

## File Structure

### Authentication Components
```
src/app/
├── pages/
│   ├── admin-login/
│   │   └── admin-login.component.ts    # Admin login page
│   └── booking/
│       └── booking.component.ts         # User booking (triggers Google OAuth)
├── guards/
│   └── auth.guard.ts                    # Route guards
└── services/
    ├── auth.service.ts                  # Auth logic
    └── supabase.service.ts              # Supabase client
```

### Key Methods

**SupabaseService:**
```typescript
// For users (Google OAuth)
signInWithGoogle(): Promise<void>

// For admins (Email/Password)
signInWithEmailPassword(email: string, password: string): Promise<AuthData>

// For both
signOut(): Promise<void>
getUserProfile(userId: string): Promise<UserProfile>
```

**AuthService:**
```typescript
// Authentication state
isAuthenticated(): boolean
isAuthenticated$: Observable<boolean>

// Role checking
isAdmin(): boolean
isSuperAdmin(): boolean
hasRole(roles: string[]): boolean

// User data
getUserProfile(): UserProfile | null
userProfile$: Observable<UserProfile | null>
```

## Common Issues

### Issue: Can't login to admin

**Check:**
1. User created in Supabase Auth?
2. Profile updated with Auth user ID?
3. Role set to 'admin' or 'superadmin'?
4. Using correct password?

**Debug:**
```sql
-- Check profile exists and has admin role
SELECT id, email, role FROM profiles WHERE email = 'admin@kolkatascotty.com';

-- Check Auth user exists
SELECT id, email FROM auth.users WHERE email = 'admin@kolkatascotty.com';

-- They should have matching IDs
```

### Issue: Google OAuth not working

**Check:**
1. Google OAuth configured in Supabase?
2. Client ID and Secret correct?
3. Redirect URIs whitelisted?
4. Browser allowing popups?

**Debug:**
Check browser console for errors (F12)

### Issue: Redirected to login after admin login

**Reason:** User doesn't have admin role

**Fix:**
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### Issue: "Sign In" button shows when logged in

**Reason:** Profile not loaded

**Debug:**
```typescript
// Check in browser console
authService.getUserProfile()
// Should return user object, not null
```

## Production Checklist

- [ ] Change default admin password
- [ ] Configure Google OAuth with production domain
- [ ] Update Supabase redirect URIs
- [ ] Enable RLS policies
- [ ] Test both auth flows
- [ ] Test role-based access
- [ ] Test protected routes
- [ ] Monitor Supabase logs

## Demo Credentials

**Admin Login:**
```
URL: /admin/login
Email: admin@kolkatascotty.com
Password: admin123
```

**Super Admin Login:**
```
URL: /admin/login
Email: superadmin@kolkatascotty.com
Password: admin123
```

**Users:**
Use any Google account via "Sign In" button

## Summary

### User Authentication
- ✅ Google OAuth only
- ✅ Quick sign-in
- ✅ Auto profile creation
- ✅ Access to booking system
- ✅ User menu in navigation

### Admin Authentication
- ✅ Separate login page at /admin/login
- ✅ Email/password authentication
- ✅ Role verification
- ✅ Protected admin routes
- ✅ Full admin panel access

### Security
- ✅ Separate auth methods
- ✅ Role-based access control
- ✅ Protected routes with guards
- ✅ Secure session management
- ✅ No admin access from user menu

Your authentication system is now complete! Users and admins have separate, secure login flows.
