# Quick Start Guide - Kolkata Scotty

## ✅ What's Been Implemented

### Two Separate Authentication Systems

1. **Google OAuth** - For regular users (customers booking slots)
2. **Email/Password** - For admin access at `/admin/login`

### Key Features

- ✅ Separate admin login page
- ✅ Google OAuth only for customers
- ✅ Clean SQL seed file with demo data
- ✅ Protected admin routes
- ✅ Role-based access control
- ✅ Build succeeds without errors

## Quick Setup (5 Minutes)

### 1. Install & Start

```bash
npm install
npm start
# Opens at http://localhost:4200
```

### 2. Run Migrations

In Supabase SQL Editor:
```sql
-- Run: supabase/migrations/20251030113003_fix_security_and_performance_issues.sql
```

### 3. Create Admin User

**Supabase Dashboard → Authentication → Users → Add User:**
- Email: `admin@kolkatascotty.com`
- Password: `admin123`
- Auto Confirm: ✓ Yes

**Copy user ID, then run:**
```sql
UPDATE profiles SET id = 'USER_ID_HERE' WHERE email = 'admin@kolkatascotty.com';
```

### 4. Run Seed Data

In Supabase SQL Editor:
```sql
-- Run: supabase/seed.sql
```

Creates:
- 3 Trainers
- 63 Time slots (next 7 days)
- 3 Demo customers
- System settings

## Test the Flows

### Customer Flow (Google OAuth)

1. Visit `http://localhost:4200`
2. Click "Sign In" (top right)
3. Login with Google
4. Redirects to /booking
5. Book a slot ✓

**Expected:** Google OAuth works, can book slots, no admin access

### Admin Flow (Email/Password)

1. Visit `http://localhost:4200/admin/login`
2. Enter:
   - Email: `admin@kolkatascotty.com`
   - Password: `admin123`
3. Click "Sign In"
4. Admin dashboard loads ✓

**Expected:** Email login works, admin panel accessible

## Routes

### Customer
```
/           - Home
/booking    - Book slots (Google OAuth)
/about      - About
/courses    - Courses
/trainers   - Trainers
/contact    - Contact
```

### Admin
```
/admin/login    - Admin login (Email/Password)
/admin          - Dashboard
/admin/bookings - Manage bookings
/admin/slots    - Manage slots
/admin/trainers - Manage trainers
/admin/users    - Manage users
/admin/settings - Settings
/admin/audit    - Audit logs
```

## Seed Data Summary

**After running seed.sql:**

- **Profiles:** 8 (2 admins, 3 customers, 3 trainers)
- **Trainers:** 3 with specializations
- **Slots:** 63 (7 days × 9 slots/day)
- **Bookings:** 1 sample
- **Settings:** Business hours, pricing, rules

**Demo Trainers:**
```
Rajesh Mehta - Beginner Training, Highway Riding (4.8⭐)
Sanjay Das - Safety Training, Defensive Riding (4.9⭐)
Vikram Patel - Sports Bikes, Advanced Maneuvers (4.7⭐)
```

**Time Slots:**
```
Morning: 9-11 AM
Afternoon: 2-4 PM
Evening: 6-8 PM
```

## Common Commands

```bash
# Start dev
npm start

# Build
npm run build

# Check if working
curl http://localhost:4200
```

## Documentation

📘 **AUTHENTICATION_GUIDE.md** - Complete auth setup
📘 **QUICK_START.md** - This file
📘 **LOCAL_SETUP.md** - Development setup
📘 **supabase/seed.sql** - Demo data script

## Troubleshooting

### Admin login fails

**Check:**
```sql
SELECT email, role FROM profiles WHERE email = 'admin@kolkatascotty.com';
-- Should show role = 'admin'
```

**Fix:**
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@kolkatascotty.com';
```

### Google OAuth not working

**Check:** Supabase Dashboard → Authentication → Providers → Google
- Enabled? ✓
- Client ID added? ✓
- Secret added? ✓

### Seed data fails

**Run step by step:**
1. Migrations first
2. Create admin user in Auth
3. Link profile
4. Run seed.sql

## Build Status

✅ **Build succeeds!**
```
Application bundle generation complete. [13.576 seconds]
Bundle size: 461 KB
```

## Success Checklist

- [ ] `npm start` works
- [ ] `npm run build` succeeds
- [ ] Admin login at /admin/login works
- [ ] Google OAuth for customers works
- [ ] Can book slots as customer
- [ ] Can access admin panel as admin
- [ ] Seed data loaded successfully

## Next Steps

1. Test both auth flows
2. Customize seed data
3. Configure Google OAuth for production
4. Change admin password
5. Deploy!

## Deploy

```bash
# Build
npm run build

# Output: dist/demo/

# Deploy to Vercel/Netlify
# Add environment variables
```

**Environment Variables:**
```
VITE_SUPABASE_URL=https://cogzshqrbuzhvstvjpso.supabase.co
VITE_SUPABASE_ANON_KEY=[your-key]
```

Your app is ready! 🎉

**Customer Auth:** Google OAuth ✓
**Admin Auth:** Email/Password at /admin/login ✓
**Demo Data:** Clean seed file ✓
**Build:** Passes ✓
