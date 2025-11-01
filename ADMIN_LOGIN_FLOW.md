# Admin Login & Access Flow - Complete Guide

## ✅ What's Been Fixed

Your admin login flow now works completely! Here's what's been added:

### 1. Navigation Login Button
- ✅ "Sign In" button in main navigation
- ✅ Google OAuth integration
- ✅ User profile menu when logged in
- ✅ Admin Panel link (only for admins)
- ✅ Sign out functionality

### 2. User Menu (After Login)
- Shows user name and avatar
- Dropdown menu with:
  - **Admin Panel** (only for admin/superadmin roles)
  - **My Bookings**
  - **Sign Out**

### 3. Protected Routes
- Admin routes require authentication
- Admin routes require admin/superadmin role
- Automatic redirect if not authorized

## Complete Login Flow

### For Regular Users

1. **Visit Site**
   - Go to http://localhost:4200
   - Click "Sign In" button in navigation

2. **Google OAuth**
   - Redirects to Google login
   - Choose your Google account
   - Grant permissions

3. **After Login**
   - Automatically creates profile in database
   - Shows user menu with name/avatar
   - Can access:
     - Booking page (create bookings)
     - View their bookings
     - Profile settings

### For Admin Users

1. **Sign In** (same as regular users)

2. **Get Admin Access**
   After first login, run this SQL in Supabase:
   ```sql
   -- Replace with your email
   UPDATE profiles
   SET role = 'admin'
   WHERE email = 'your-email@gmail.com';
   ```

3. **Access Admin Panel**
   - After role update, click user menu
   - See "⚙️ Admin Panel" option
   - Click to access admin dashboard

4. **Admin Features**
   - Dashboard with statistics
   - Manage all bookings
   - Manage slots
   - Manage trainers
   - Manage users (superadmin only)
   - View audit logs
   - System settings

## Step-by-Step Testing

### Test 1: Login Works

```bash
# 1. Start dev server
npm start

# 2. Open browser
# Visit: http://localhost:4200

# 3. Click "Sign In" button (top right)

# 4. Complete Google OAuth

# 5. Should redirect back, showing user menu
```

**Expected Result:**
- ✅ User menu appears with your name
- ✅ Dropdown shows "My Bookings" and "Sign Out"
- ✅ No "Admin Panel" option yet (not admin)

### Test 2: Grant Admin Access

```bash
# 1. Get your user email from the menu

# 2. Go to Supabase Dashboard
# Visit: https://supabase.com/dashboard/project/cogzshqrbuzhvstvjpso

# 3. Go to SQL Editor

# 4. Run this query:
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-actual-email@gmail.com';

# 5. Refresh your app
```

**Expected Result:**
- ✅ User menu now shows "⚙️ Admin Panel" option

### Test 3: Access Admin Panel

```bash
# 1. Click user menu (top right)

# 2. Click "⚙️ Admin Panel"

# 3. Should navigate to /admin
```

**Expected Result:**
- ✅ Admin dashboard loads
- ✅ Shows statistics
- ✅ Sidebar with admin options
- ✅ Can navigate admin pages

### Test 4: Admin Routes Protected

```bash
# 1. Sign out

# 2. Try to access /admin directly
# Visit: http://localhost:4200/admin
```

**Expected Result:**
- ✅ Redirects to home page
- ✅ Cannot access without login

## User Roles Explained

### Customer (Default)
```javascript
role: 'customer'
```
**Can access:**
- ✅ All public pages
- ✅ Booking page (create bookings)
- ✅ View their own bookings

**Cannot access:**
- ❌ Admin panel
- ❌ Other users' data

### Admin
```javascript
role: 'admin'
```
**Can access:**
- ✅ Everything customers can
- ✅ Admin dashboard
- ✅ Manage bookings
- ✅ Manage slots
- ✅ Manage trainers
- ✅ View audit logs
- ✅ System settings

**Cannot access:**
- ❌ User management (superadmin only)

### Superadmin
```javascript
role: 'superadmin'
```
**Can access:**
- ✅ Everything admins can
- ✅ User management
- ✅ Role assignment
- ✅ All system features

## Grant Admin Access via SQL

### Make User Admin

```sql
-- Replace with actual email
UPDATE profiles
SET role = 'admin'
WHERE email = 'user@example.com';
```

### Make User Superadmin

```sql
UPDATE profiles
SET role = 'superadmin'
WHERE email = 'admin@example.com';
```

### Check User Role

```sql
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE email = 'user@example.com';
```

### List All Admins

```sql
SELECT email, full_name, role, created_at
FROM profiles
WHERE role IN ('admin', 'superadmin')
ORDER BY created_at DESC;
```

## Navigation Features

### When Not Logged In
```
Home | About | Courses | Trainers | Contact | Book Now | [Sign In]
```

### When Logged As Customer
```
Home | About | Courses | Trainers | Contact | Book Now | [User Menu ▼]
  └─ My Bookings
  └─ Sign Out
```

### When Logged As Admin
```
Home | About | Courses | Trainers | Contact | Book Now | [User Menu ▼]
  └─ ⚙️ Admin Panel
  └─ My Bookings
  └─ Sign Out
```

## Admin Panel Features

### Dashboard (`/admin`)
- Total users count
- Total bookings count
- Active trainers count
- Upcoming bookings count
- Recent activity

### Bookings Management (`/admin/bookings`)
- View all bookings
- Filter by status
- View user details
- View trainer details
- Modify booking status
- Cancel bookings

### Slots Management (`/admin/slots`)
- View all time slots
- Create new slots
- Edit existing slots
- Mark slots as unavailable
- Set capacity
- Assign trainers

### Trainers Management (`/admin/trainers`)
- View all trainers
- Add new trainers
- Edit trainer profiles
- Set specializations
- Manage availability
- View ratings

### Users Management (`/admin/users`)
**Superadmin only**
- View all users
- Change user roles
- View user activity
- Manage user profiles

### Settings (`/admin/settings`)
- System configuration
- Business hours
- Pricing settings
- Email templates
- SMS settings

### Audit Logs (`/admin/audit`)
- View all system actions
- Track user changes
- Monitor admin actions
- Export logs

## Troubleshooting

### Issue: "Sign In" Button Not Showing

**Check:**
```typescript
// src/app/app.component.ts should have:
import { AuthService } from './services/auth.service';
constructor(public authService: AuthService) {}
```

**Solution:**
Already implemented! Refresh browser.

### Issue: Can't See Admin Panel Option

**Reason:** Not an admin yet

**Solution:**
```sql
-- Run in Supabase SQL Editor
UPDATE profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```

Then refresh page.

### Issue: Clicking Admin Panel Does Nothing

**Check:**
1. Role is set: `SELECT role FROM profiles WHERE email = 'your@email.com';`
2. Should return: `admin` or `superadmin`
3. Refresh browser after role change

### Issue: Redirected Away from Admin

**Reason:** Guard blocking access

**Check Console:**
```javascript
// Press F12, check for errors
// Should see authentication state
```

**Solution:**
1. Sign in again
2. Check role is set correctly
3. Clear browser cache

### Issue: User Menu Not Appearing After Login

**Check:**
1. OAuth completed successfully
2. Profile created in database
3. Browser console for errors

**Debug:**
```sql
-- Check if profile exists
SELECT * FROM profiles ORDER BY created_at DESC LIMIT 1;
```

## Google OAuth Setup

If OAuth isn't configured:

### 1. Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Create new project or select existing
3. Enable Google+ API

### 2. Create OAuth Credentials

1. APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs:
   ```
   https://cogzshqrbuzhvstvjpso.supabase.co/auth/v1/callback
   http://localhost:4200
   ```

### 3. Configure Supabase

1. Go to Supabase Dashboard
2. Authentication → Providers
3. Enable Google
4. Add Client ID and Secret
5. Save

## Testing Checklist

- [ ] Click "Sign In" button shows Google OAuth
- [ ] After login, user menu appears with name
- [ ] Dropdown shows "My Bookings" and "Sign Out"
- [ ] After setting admin role, "Admin Panel" appears
- [ ] Clicking "Admin Panel" navigates to /admin
- [ ] Admin dashboard loads with stats
- [ ] Admin sidebar shows all sections
- [ ] Sign out works and clears session
- [ ] Direct access to /admin when logged out redirects home
- [ ] Direct access to /admin as customer redirects home
- [ ] Direct access to /admin as admin works

## Flow Summary

```
User Journey:
1. Visit site → Not logged in
2. Click "Sign In" → Google OAuth
3. Login with Google → Profile created (role: customer)
4. Back to site → User menu appears
5. Admin grants admin role → SQL UPDATE
6. User refreshes → "Admin Panel" option appears
7. Click "Admin Panel" → Access admin dashboard
8. Full admin features available
```

## Files Modified

### Updated Files
- ✅ `src/app/app.component.ts` - Added login button & user menu
- ✅ `src/app/guards/auth.guard.ts` - Already has admin guard
- ✅ `src/app/services/auth.service.ts` - Already has auth logic
- ✅ `src/app/app.routes.ts` - Already has admin routes

### No Changes Needed
- ✅ Authentication service already works
- ✅ Admin guards already configured
- ✅ Supabase connection already set up

## Success!

Your admin login flow is now complete:

✅ Login button in navigation
✅ Google OAuth integration
✅ User profile menu
✅ Admin panel access for admins
✅ Protected admin routes
✅ Role-based access control
✅ Sign out functionality

**To test:** Just click "Sign In" in the navigation and follow the flow!
