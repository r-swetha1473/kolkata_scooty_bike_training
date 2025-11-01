# PostgreSQL Local Setup Guide

## ✅ Complete - No Supabase!

Your application now uses **local PostgreSQL database directly** with a Node.js/Express backend.

### What Changed

- ❌ Removed Supabase dependencies
- ✅ Using local PostgreSQL database
- ✅ Node.js/Express REST API backend
- ✅ JWT authentication
- ✅ Google OAuth via Passport.js
- ✅ Direct database connection

## Quick Setup (10 Minutes)

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE kolkata_scotty;
CREATE USER scotty_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty_user;

# Exit
\q
```

### 3. Setup Backend

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env file
nano .env
```

**Configure .env:**
```env
DATABASE_URL=postgresql://scotty_user:your_password@localhost:5432/kolkata_scotty
JWT_SECRET=generate-a-random-secret-key-here
SESSION_SECRET=another-random-secret-key-here
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200

# Google OAuth (optional, for user login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 4. Run Database Schema

```bash
# Still in backend directory
psql -d kolkata_scotty -f schema.sql
```

This creates all tables:
- profiles
- trainers
- slots
- bookings
- audit_logs
- settings

### 5. Create Admin User

```bash
# In PostgreSQL
psql -d kolkata_scotty

# Create admin profile
INSERT INTO profiles (email, full_name, phone, role, password_hash)
VALUES (
  'admin@kolkatascotty.com',
  'Admin User',
  '+91 98765 00001',
  'admin',
  '$2b$10$YourHashedPasswordHere'  -- See password hashing below
);
```

**To generate password hash:**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(console.log);"
```

### 6. Start Backend Server

```bash
# In backend directory
npm install
npm run dev
```

Should see:
```
Server running on port 3000
Database connected
```

### 7. Start Frontend

```bash
# In project root
npm install
npm start
```

Opens at: http://localhost:4200

## Architecture

```
┌─────────────────┐
│  Angular App    │
│  (Port 4200)    │
└────────┬────────┘
         │ HTTP API
         ↓
┌─────────────────┐
│  Express API    │
│  (Port 3000)    │
└────────┬────────┘
         │ SQL
         ↓
┌─────────────────┐
│  PostgreSQL DB  │
│  (Port 5432)    │
└─────────────────┘
```

## API Endpoints

### Authentication
```
POST   /api/auth/login          - Admin email/password login
POST   /api/auth/logout         - Logout
GET    /api/auth/me             - Get current user
GET    /api/auth/google         - Google OAuth redirect
GET    /api/auth/google/callback - Google OAuth callback
```

### Bookings (Users)
```
GET    /api/slots               - Get available slots
GET    /api/slots?date=YYYY-MM-DD - Get slots by date
GET    /api/bookings/my         - Get my bookings
POST   /api/bookings            - Create booking
POST   /api/bookings/:id/cancel - Cancel booking
```

### Admin
```
GET    /api/admin/stats         - Dashboard stats
GET    /api/admin/bookings      - All bookings
GET    /api/admin/slots         - All slots
GET    /api/admin/trainers      - All trainers
GET    /api/admin/users         - All users
GET    /api/admin/audit         - Audit logs
GET    /api/admin/settings      - Get settings
PUT    /api/admin/settings      - Update settings
```

## Authentication Flows

### Admin Login (Email/Password)
```
1. User visits /admin/login
2. Enters email & password
3. POST /api/auth/login
4. Backend validates credentials
5. Returns JWT token
6. Frontend stores token
7. Redirects to /admin
```

### Customer Login (Google OAuth)
```
1. User clicks "Sign In"
2. Redirects to /api/auth/google
3. Google OAuth flow
4. Callback to /api/auth/google/callback
5. Backend creates/updates profile
6. Returns JWT token
7. Redirects to /booking
```

## Database Schema

### profiles
```sql
id          UUID PRIMARY KEY
email       TEXT UNIQUE NOT NULL
full_name   TEXT NOT NULL
phone       TEXT
avatar_url  TEXT
role        TEXT (customer|trainer|admin|superadmin)
password_hash TEXT (for admin/email login)
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

### trainers
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES profiles(id)
bio               TEXT
experience_years  INTEGER
specialization    TEXT[]
rating            DECIMAL
total_sessions    INTEGER
is_active         BOOLEAN
```

### slots
```sql
id            UUID PRIMARY KEY
trainer_id    UUID REFERENCES trainers(id)
start_time    TIMESTAMP
end_time      TIMESTAMP
capacity      INTEGER
booked_count  INTEGER
status        TEXT
```

### bookings
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES profiles(id)
slot_id     UUID REFERENCES slots(id)
trainer_id  UUID REFERENCES trainers(id)
status      TEXT
notes       TEXT
created_at  TIMESTAMP
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/db_name
JWT_SECRET=random-secret-for-jwt-tokens
SESSION_SECRET=random-secret-for-sessions
GOOGLE_CLIENT_ID=from-google-cloud-console
GOOGLE_CLIENT_SECRET=from-google-cloud-console
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4200
```

### Frontend (environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api'
};
```

## Testing

### Test Backend
```bash
# Check health
curl http://localhost:3000/health

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kolkatascotty.com","password":"admin123"}'
```

### Test Frontend
```bash
# Visit pages
http://localhost:4200/              # Home
http://localhost:4200/booking       # Booking (requires Google login)
http://localhost:4200/admin/login   # Admin login
```

## Common Issues

### Can't connect to PostgreSQL

**Check if running:**
```bash
pg_isready
```

**Start PostgreSQL:**
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql
```

### Database doesn't exist

```bash
createdb kolkata_scotty
psql -d kolkata_scotty -f backend/schema.sql
```

### Backend won't start

**Check:**
1. PostgreSQL running?
2. DATABASE_URL correct in .env?
3. npm install completed?

**Debug:**
```bash
cd backend
npm run dev
# Check error messages
```

### Frontend can't reach backend

**Check:**
1. Backend running on port 3000?
2. CORS enabled in backend?
3. apiUrl correct in environment.ts?

### Admin login fails

**Check:**
1. Admin user exists in database?
2. Password hash correct?
3. Role is 'admin' or 'superadmin'?

**Verify:**
```sql
SELECT email, role FROM profiles WHERE email = 'admin@kolkatascotty.com';
```

## Production Deployment

### Backend

```bash
# Build
npm run build

# Set production env
export NODE_ENV=production
export DATABASE_URL=your-production-db-url

# Run
npm start
```

### Frontend

```bash
# Update API URL in environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://your-api-domain.com/api'
};

# Build
npm run build

# Deploy dist/demo to hosting
```

## File Structure

```
project/
├── src/                         # Angular frontend
│   ├── app/
│   │   ├── services/
│   │   │   ├── http.service.ts       # HTTP client wrapper
│   │   │   ├── auth.service.ts       # Authentication
│   │   │   ├── booking.service.ts    # Bookings
│   │   │   └── admin.service.ts      # Admin operations
│   │   ├── pages/
│   │   │   ├── admin-login/          # Admin login page
│   │   │   └── booking/              # Booking page
│   │   └── guards/
│   │       └── auth.guard.ts         # Route protection
│   └── environments/
│       ├── environment.ts            # Dev config
│       └── environment.prod.ts       # Prod config
│
└── backend/                     # Node.js API
    ├── server.js                # Express server
    ├── db.js                    # PostgreSQL connection
    ├── schema.sql               # Database schema
    ├── routes/
    │   ├── auth.js              # Auth endpoints
    │   ├── bookings.js          # Booking endpoints
    │   └── admin.js             # Admin endpoints
    ├── config/
    │   └── passport.js          # Passport.js config
    └── middleware/
        └── auth.js              # JWT auth middleware
```

## Benefits of Local PostgreSQL

✅ **Full Control** - Complete control over database
✅ **No Vendor Lock-in** - Not tied to Supabase
✅ **Cost** - Free for development
✅ **Privacy** - Data stays local
✅ **Performance** - Direct connection, no network latency
✅ **Flexibility** - Use any PostgreSQL features
✅ **Debugging** - Easy to inspect and debug locally

## Summary

Your app now uses:
- ✅ Local PostgreSQL database
- ✅ Node.js/Express REST API
- ✅ JWT token authentication
- ✅ Google OAuth for users
- ✅ Email/password for admins
- ✅ No Supabase dependencies
- ✅ Build succeeds (310 KB bundle)

**Backend:** http://localhost:3000
**Frontend:** http://localhost:4200
**Admin Login:** /admin/login

Everything runs locally with direct PostgreSQL connection!
