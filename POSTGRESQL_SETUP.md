# PostgreSQL Backend Setup Guide

## Overview

Your application now has a custom Node.js/Express backend with PostgreSQL database, replacing Supabase.

## What's Been Created

### Backend Structure
```
backend/
├── server.js              # Main Express server
├── db.js                  # PostgreSQL connection pool
├── schema.sql             # Database schema
├── package.json           # Backend dependencies
├── .env.example           # Environment variables template
├── config/
│   └── passport.js        # Google OAuth configuration
├── middleware/
│   └── auth.js            # JWT authentication
└── routes/
    ├── auth.js            # Authentication endpoints
    ├── profiles.js        # User profile endpoints
    ├── trainers.js        # Trainer endpoints
    ├── slots.js           # Slot endpoints
    ├── bookings.js        # Booking endpoints
    └── admin.js           # Admin endpoints
```

### Frontend Service
```
src/app/services/
└── api.service.ts         # Angular service for API calls
```

## Prerequisites

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 2. Install Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
brew install node
```

**Windows:**
Download from https://nodejs.org/

## Database Setup

### 1. Create Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE kolkata_scotty;
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO your_username;
\q
```

### 2. Run Schema

```bash
cd backend
psql -U your_username -d kolkata_scotty -f schema.sql
```

### 3. Verify Tables

```bash
psql -U your_username -d kolkata_scotty

# In PostgreSQL shell:
\dt  # List tables
# You should see: profiles, trainers, slots, bookings, audit_logs, settings
```

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/kolkata_scotty
JWT_SECRET=generate-a-random-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=generate-another-random-secret-key
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

### 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### 4. Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server should start on `http://localhost:3000`

### 5. Test Backend

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}

# Get trainers (public endpoint)
curl http://localhost:3000/api/trainers
```

## Frontend Setup

### 1. Install HttpClient Module

Update `src/app/app.component.ts`:

```typescript
import { HttpClientModule } from '@angular/common/http';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // ... other imports
    HttpClientModule
  ],
  providers: [ApiService],
  // ...
})
```

### 2. Update Components to Use ApiService

Replace Supabase service with ApiService in your components:

```typescript
import { ApiService } from '../services/api.service';

export class YourComponent {
  constructor(private api: ApiService) {}

  ngOnInit() {
    // Example: Get trainers
    this.api.getTrainers().subscribe(trainers => {
      console.log(trainers);
    });
  }

  signIn() {
    this.api.signInWithGoogle();
  }

  signOut() {
    this.api.signOut().subscribe(() => {
      console.log('Signed out');
    });
  }
}
```

### 3. Handle OAuth Callback

Update your booking component to handle the token from Google OAuth:

```typescript
ngOnInit() {
  // Check for token in URL (from OAuth callback)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    this.api.setToken(token);
    // Remove token from URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Load user data
  this.api.currentUser$.subscribe(user => {
    console.log('Current user:', user);
  });
}
```

## API Endpoints

### Authentication
- `GET /api/auth/google` - Initiate Google OAuth login
- `GET /api/auth/google/callback` - OAuth callback (handled automatically)
- `POST /api/auth/logout` - Logout user

### Profiles
- `GET /api/profiles/me` - Get current user profile (authenticated)
- `PUT /api/profiles/me` - Update current user profile (authenticated)

### Trainers
- `GET /api/trainers` - Get all trainers (public)
- `GET /api/trainers/:id` - Get trainer by ID (public)

### Slots
- `GET /api/slots` - Get available slots (public)
  - Query params: `trainer_id`, `start_date`, `end_date`

### Bookings
- `POST /api/bookings` - Create booking (authenticated)
  - Body: `{ slot_id, notes }`
- `GET /api/bookings/my-bookings` - Get user's bookings (authenticated)
- `PUT /api/bookings/:id/cancel` - Cancel booking (authenticated)
  - Body: `{ cancellation_reason }`

### Admin (requires admin/superadmin role)
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/users` - Get all users
- `GET /api/admin/dashboard` - Get dashboard statistics

## Testing

### 1. Create Test Data

```sql
-- Connect to database
psql -U your_username -d kolkata_scotty

-- Create admin user
INSERT INTO profiles (email, full_name, role)
VALUES ('admin@test.com', 'Admin User', 'admin');

-- Create trainer profile
INSERT INTO profiles (email, full_name, role)
VALUES ('trainer@test.com', 'Test Trainer', 'trainer')
RETURNING id;

-- Use the returned ID in next query
INSERT INTO trainers (user_id, bio, experience_years, specialization, rating, is_active)
VALUES ('UUID-FROM-ABOVE', 'Experienced trainer', 10, ARRAY['Beginner Training'], 4.9, true)
RETURNING id;

-- Create slots for next 7 days
INSERT INTO slots (trainer_id, start_time, end_time, capacity, status)
SELECT
  'TRAINER-UUID',
  (CURRENT_DATE + (day || ' days')::interval + (hour || ' hours')::interval)::timestamptz,
  (CURRENT_DATE + (day || ' days')::interval + (hour || ' hours')::interval + interval '30 minutes')::timestamptz,
  1,
  'available'
FROM generate_series(0, 6) AS day,
     generate_series(9, 20) AS hour;
```

### 2. Test Authentication Flow

1. Start backend: `npm run dev`
2. Start frontend: `npm start`
3. Click "Sign in with Google"
4. Should redirect to Google
5. After auth, should redirect back with token
6. Check browser console for user data

## Production Deployment

### Backend (Node.js + PostgreSQL)

**Option 1: Heroku**
```bash
# Install Heroku CLI
heroku create your-app-name
heroku addons:create heroku-postgresql:mini
heroku config:set JWT_SECRET=your-secret
heroku config:set GOOGLE_CLIENT_ID=your-id
heroku config:set GOOGLE_CLIENT_SECRET=your-secret
heroku config:set FRONTEND_URL=https://your-frontend-domain.com
git subtree push --prefix backend heroku main
```

**Option 2: Railway**
1. Push code to GitHub
2. Go to [Railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Add PostgreSQL service
5. Add environment variables
6. Deploy

**Option 3: DigitalOcean App Platform**
1. Push code to GitHub
2. Create new app on DigitalOcean
3. Add PostgreSQL database
4. Configure environment variables
5. Deploy

### Frontend (Angular)

Deploy to Vercel/Netlify as before, but update environment:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-backend-domain.com/api'
};
```

Update `api.service.ts`:
```typescript
import { environment } from '../../environments/environment';

private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
```

## Troubleshooting

### Backend won't start
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check port 3000 is available
lsof -i :3000

# Check database connection
psql -U your_username -d kolkata_scotty
```

### Database connection errors
- Verify DATABASE_URL in `.env`
- Check PostgreSQL is accepting connections
- Verify user has proper permissions

### Google OAuth not working
- Check redirect URIs in Google Console match `.env`
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Check CORS settings in server.js

### CORS errors
Update `server.js` if needed:
```javascript
app.use(cors({
  origin: ['http://localhost:4200', 'https://your-production-domain.com'],
  credentials: true
}));
```

## Security Notes

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use strong secrets** - Generate random strings for JWT_SECRET and SESSION_SECRET
3. **Enable SSL in production** - Use HTTPS for all connections
4. **Implement rate limiting** - Already configured in server.js
5. **Validate all inputs** - Add validation middleware as needed
6. **Use prepared statements** - All queries use parameterized queries (✅ already done)

## Next Steps

1. ✅ Backend created with Express + PostgreSQL
2. ✅ Database schema defined
3. ✅ API endpoints implemented
4. ✅ Authentication with Google OAuth
5. ✅ Angular service created
6. ⏳ Update frontend components to use new API
7. ⏳ Test complete flow
8. ⏳ Deploy to production

## Support

For issues:
1. Check backend logs: `npm run dev` output
2. Check database: `psql` connection
3. Check frontend console: F12 in browser
4. Verify environment variables in `.env`

Your PostgreSQL backend is ready to use! No more Supabase dependency.
