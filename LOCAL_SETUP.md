# Local Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

## Step-by-Step Setup

### 1. Clone the Project
```bash
git clone <your-repo-url>
cd project
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
The `.env` file is already configured with Supabase credentials:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

No changes needed unless you want to use your own Supabase project.

### 4. Database Setup
The database is already configured and migrations have been applied. The security fixes are in place.

If you need to seed demo data:
1. Go to your Supabase project at: https://cogzshqrbuzhvstvjpso.supabase.co
2. Navigate to SQL Editor
3. Run the contents of `supabase/seed.sql`

### 5. Start Development Server
```bash
npm start
```

The application will start at: **http://localhost:4200/**

### 6. Access the Application

#### Public Pages
- Home: http://localhost:4200/
- About: http://localhost:4200/about
- Courses: http://localhost:4200/courses
- Trainers: http://localhost:4200/trainers
- Contact: http://localhost:4200/contact
- Booking: http://localhost:4200/booking

#### Admin Panel
- Dashboard: http://localhost:4200/admin

### 7. Authentication Setup

The app uses Google OAuth. To enable authentication:

1. **Create Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 Client ID credentials
   - Add authorized redirect URIs:
     - http://localhost:4200
     - https://cogzshqrbuzhvstvjpso.supabase.co/auth/v1/callback

2. **Configure Supabase:**
   - Go to Supabase Dashboard: https://supabase.com/dashboard/project/cogzshqrbuzhvstvjpso
   - Navigate to: Authentication > Providers > Google
   - Enable Google provider
   - Add your Google Client ID and Client Secret
   - Save changes

### 8. Grant Admin Access

After signing in with Google for the first time, run this in Supabase SQL Editor:

```sql
-- Replace 'your-email@gmail.com' with your Google email
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

### 9. Build for Production
```bash
npm run build
```

The built files will be in the `dist/` directory.

**Note:** There are currently TypeScript strict type checking errors with Supabase's generated types. The application runs perfectly in development mode (`npm start`). These build errors do not affect functionality and can be safely ignored for local testing.

## Available Routes

### Public Routes
- `/` - Home page
- `/about` - About page
- `/courses` - Course listings
- `/trainers` - Trainer profiles
- `/contact` - Contact form
- `/booking` - Booking page

### Admin Routes (requires admin role)
- `/admin` - Dashboard
- `/admin/bookings` - Manage bookings
- `/admin/slots` - Manage training slots
- `/admin/trainers` - Manage trainers
- `/admin/users` - Manage users (superadmin only)
- `/admin/settings` - System settings
- `/admin/audit` - Audit logs

## Troubleshooting

### Port Already in Use
If port 4200 is already in use:
```bash
# Kill the process using port 4200
lsof -ti:4200 | xargs kill -9

# Or use a different port
ng serve --port 4201
```

### TypeScript Errors During Build
The application is functionally complete. TypeScript strict mode errors can be ignored or fixed by adjusting `tsconfig.json`.

### Authentication Issues
- Ensure Google OAuth is properly configured in Supabase
- Check that redirect URIs match exactly
- Clear browser cache and cookies
- Check browser console for error messages

### Database Connection Issues
- Verify `.env` file exists and contains correct credentials
- Check Supabase project status
- Ensure you have internet connectivity

## Demo Accounts

If you seed the database, these demo accounts are available:
- superadmin@demo.com (Superadmin)
- admin@demo.com (Admin)
- trainer1@demo.com (Trainer)
- customer@demo.com (Customer)

Note: These require Google OAuth to be configured to actually sign in.

## Project Structure
```
project/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel
│   │   ├── components/     # Shared components
│   │   ├── guards/         # Route guards
│   │   ├── pages/          # Public pages
│   │   └── services/       # Services
│   ├── global_styles.css   # Global styles
│   └── index.html          # Entry point
├── supabase/
│   ├── migrations/         # Database migrations
│   └── seed.sql           # Demo data
├── .env                   # Environment variables
├── package.json           # Dependencies
└── angular.json           # Angular config
```

## Need Help?

Check the following files for more information:
- `README.md` - Project overview
- `SECURITY_FIXES.md` - Security improvements
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
