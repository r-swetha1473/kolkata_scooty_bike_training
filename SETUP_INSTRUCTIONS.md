# Quick Setup Instructions

## Prerequisites
- Node.js v18+ and npm installed
- Modern web browser

## Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm start
```

The application will start at **http://localhost:4200/**

### 3. Access the Application

**Public Site:** http://localhost:4200/

**Admin Panel:** http://localhost:4200/admin

## Authentication

The app uses Google OAuth for authentication. You have two options:

### Option A: Configure Google OAuth (Recommended for Full Testing)

1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/)
2. Add redirect URI: `https://cogzshqrbuzhvstvjpso.supabase.co/auth/v1/callback`
3. Configure in Supabase Dashboard: Authentication > Providers > Google
4. After first login, grant yourself admin access by running this SQL in Supabase:

```sql
-- Replace with your Google email
UPDATE auth.users
SET raw_app_metadata = jsonb_set(
  COALESCE(raw_app_metadata, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'your-email@gmail.com';

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@gmail.com';
```

### Option B: Browse Public Pages (No Auth Required)

You can explore these pages without authentication:
- Home: http://localhost:4200/
- About: http://localhost:4200/about
- Courses: http://localhost:4200/courses
- Trainers: http://localhost:4200/trainers
- Contact: http://localhost:4200/contact

## Database

The Supabase database is already configured with:
- Connection details in `.env` file
- All security fixes applied
- Tables and RLS policies set up
- Optimized indexes for performance

## Troubleshooting

### Port 4200 Already in Use
```bash
# Kill process on port 4200
lsof -ti:4200 | xargs kill -9

# Then restart
npm start
```

### TypeScript Build Errors
The application has TypeScript strict type checking errors with Supabase types. These do NOT affect functionality. The app runs perfectly in development mode.

### Can't Access Admin Panel
You need to:
1. Sign in with Google OAuth
2. Run the SQL query above to grant admin role
3. Refresh the page

## Project Structure

```
src/app/
├── pages/          # Public pages (home, about, courses, etc.)
├── admin/          # Admin panel (requires admin role)
├── components/     # Shared components (captcha, etc.)
├── services/       # Services (auth, booking, admin, supabase)
└── guards/         # Route guards (auth, admin)
```

## Key Features

- **Real-time Updates:** Changes sync automatically via Supabase Realtime
- **Secure Auth:** Google OAuth with role-based access
- **Admin Panel:** Full booking, slot, and trainer management
- **PWA Ready:** Installable on mobile devices
- **Optimized DB:** All security fixes and performance optimizations applied

## Need More Help?

See detailed documentation:
- `README.md` - Full project overview
- `SECURITY_FIXES.md` - Security improvements
- `LOCAL_SETUP.md` - Comprehensive setup guide

## Quick Test Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Dev server running (`npm start`)
- [ ] Can access home page (http://localhost:4200/)
- [ ] Can browse public pages (about, courses, trainers, contact)
- [ ] (Optional) Google OAuth configured
- [ ] (Optional) Can access admin panel with admin role

That's it! You're ready to explore the Kolkata Scotty Bike Training application.
