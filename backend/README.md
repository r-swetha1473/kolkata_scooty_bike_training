# Kolkata Scotty Backend - Node.js/Express API

RESTful API server for the Kolkata Scotty Bike Training booking system.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Ensure PostgreSQL is installed and running. Create a database:

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE biketraining;
CREATE USER biketraining_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE biketraining TO biketraining_user;
\q
```

### 3. Apply Migrations

From the project root directory:

**Windows:**
```powershell
.\apply_postgresql_migration.ps1
```

**Linux/macOS:**
```bash
bash ../apply_postgresql_migration.sh
```

**Or manually:**
```bash
node apply_migration.js ../supabase/migrations/20250103000000_migrate_to_direct_postgresql.sql
```

### 4. Configure Environment

1. Copy the example file:
```bash
   cp env.example.txt .env
   ```

2. Edit `.env` with your configuration:
   - Database credentials
   - Google OAuth credentials
   - JWT and session secrets
   - SMTP settings
   - Frontend URL

**See [ENV_SETUP.md](./ENV_SETUP.md) for complete documentation.**

### 5. Run Development Server

```bash
npm run dev
```

Backend runs on `https://kolkata-scooty-bike-training.onrender.com`

## 📁 Project Structure

```
backend/
├── config/
│   └── passport.js          # Google OAuth configuration
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── routes/
│   ├── admin.js            # Admin API endpoints
│   ├── auth.js             # Authentication routes
│   ├── bookings.js         # Booking management
│   ├── profiles.js         # User profiles
│   ├── ratings.js          # Rating system
│   ├── settings.js         # System settings
│   ├── slots.js            # Slot management
│   ├── trainers.js         # Trainer management
│   └── vehicles.js         # Vehicle management
├── services/
│   └── email.service.js    # Email notification service
├── db.js                   # PostgreSQL connection
├── server.js               # Express server setup
└── .env                    # Environment variables (not in git)
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/google` - Google OAuth initiation
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user profile

### Public Endpoints
- `GET /api/trainers` - Get all active trainers
- `GET /api/slots/date/:date` - Get slots for a date
- `GET /api/slots/available` - Get available slots
- `POST /api/bookings` - Create a booking

### Admin Endpoints (Requires Admin Role)
- `GET /api/admin/bookings` - Get all bookings
- `PUT /api/admin/bookings/:id/status` - Update booking status
- `DELETE /api/admin/bookings/:id` - Delete booking
- `GET /api/admin/trainers` - Get all trainers
- `POST /api/admin/trainers` - Create trainer
- `PUT /api/admin/trainers/:id` - Update trainer
- `DELETE /api/admin/trainers/:id` - Delete trainer
- `GET /api/admin/slots` - Get all slots
- `POST /api/admin/slots` - Create slot
- `POST /api/admin/slots/generate` - Generate daily slots
- `PUT /api/admin/slots/:id` - Update slot
- `DELETE /api/admin/slots/:id` - Delete slot
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/role` - Update user role
- `GET /api/admin/stats` - Get dashboard statistics

**See [../API_DOCUMENTATION.md](../API_DOCUMENTATION.md) for complete API documentation.**

## 🔐 Authentication

### Admin Authentication
- Email/password login via `/api/auth/login`
- Returns JWT token for subsequent requests
- Include token in `Authorization: Bearer <token>` header

### Customer Authentication
- Google OAuth 2.0
- Redirects to frontend with JWT token and user data
- Token stored in localStorage on frontend

## 📧 Email Service

Automatic email notifications sent for:
- Booking confirmations
- Booking cancellations
- Status updates

Configure SMTP in `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@kolkatascotty.com
```

## 🧪 Testing

```bash
# Health check
curl https://kolkata-scooty-bike-training.onrender.com/api/health

# Get trainers
curl https://kolkata-scooty-bike-training.onrender.com/api/trainers

# Get slots for a date
curl https://kolkata-scooty-bike-training.onrender.com/api/slots/date/2025-01-15

# Admin login (returns JWT token)
curl -X POST https://kolkata-scooty-bike-training.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

## 🚀 Production Deployment

See **[../DEPLOYMENT.md](../DEPLOYMENT.md)** for complete deployment guide.

### Quick Deploy with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start server.js --name biketraining-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 🐛 Troubleshooting

### Database Connection
- Verify PostgreSQL is running
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in `.env`
- Test connection: `psql -h localhost -U biketraining_user -d biketraining`

### OAuth Issues
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Check redirect URI matches Google Console configuration
- Ensure `FRONTEND_URL` is correct

### Email Issues
- Verify SMTP credentials
- For Gmail, use App Password (not regular password)
- Check firewall allows SMTP connections

## 📝 Environment Variables

All required environment variables are documented in **[ENV_SETUP.md](./ENV_SETUP.md)**.

Required variables:
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Server: `PORT`, `FRONTEND_URL`, `CORS_ORIGIN`
- Security: `JWT_SECRET`, `SESSION_SECRET`
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## 📚 Additional Documentation

- **[ENV_SETUP.md](./ENV_SETUP.md)** - Complete environment variable guide
- **[../DEPLOYMENT.md](../DEPLOYMENT.md)** - Production deployment guide
- **[../API_DOCUMENTATION.md](../API_DOCUMENTATION.md)** - Full API reference

---

**Backend API ready! 🚀**
