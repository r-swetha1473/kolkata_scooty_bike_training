# Environment Variables Setup Guide

This document explains all environment variables required for the Kolkata Scotty Bike Training backend.

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual values (see sections below)

3. Restart the server after making changes

## Required Environment Variables

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `kolkata_scotty` |
| `DB_USER` | Database username | `scotty_user` |
| `DB_PASSWORD` | Database password | `your_password` |
| `DATABASE_URL` | Full connection string (alternative) | `postgresql://user:pass@host:port/db` |
| `DB_SSL` | Use TLS to PostgreSQL | Set to `true` when using **Neon** (or any cloud host) from your **local** machine while `NODE_ENV` is not `production` — otherwise the pool may connect without SSL and fail. |

#### Neon PostgreSQL

1. In the [Neon console](https://console.neon.tech), copy the connection string (pooler URL is fine for the app).
2. Put it in `backend/.env` as `DATABASE_URL=...` (usually includes `sslmode=require`).
3. For **local** runs (`npm start` / migrations) with `NODE_ENV=development`, also set `DB_SSL=true` so `db.js` enables TLS (Neon rejects non-SSL clients).

**Apply one migration file to Neon (safe for an existing database):**

```bash
cd backend
# Windows CMD:
set DB_SSL=true
node apply_migration.js ..\supabase\migrations\20260321120000_bookings_unique_slot_trainer.sql

# PowerShell:
$env:DB_SSL="true"
node apply_migration.js ..\supabase\migrations\20260321120000_bookings_unique_slot_trainer.sql
```

Passing a `.sql` path runs **only** that file and does **not** run the legacy “bootstrap everything” migration or auto-create admin. To run the old full bootstrap (empty DB only), run `node apply_migration.js` with **no** file argument.

**Multi-trainer booking constraint:** `20260321120000_bookings_unique_slot_trainer.sql` creates `idx_bookings_slot_trainer_active` (one active booking per `slot_id` + `trainer_id`). If creation fails with a duplicate-key error, clean conflicting rows in `bookings` first, then re-run.

**Error: `column "phone" of relation "bookings" does not exist`:** Run  
`node apply_migration.js ../supabase/migrations/20260321140000_add_bookings_phone_column.sql`  
(with `DB_SSL=true` if using Neon locally). That adds `bookings.phone` and backfills from `profiles` where possible.

### Server Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `3000` | `3000` |
| `NODE_ENV` | Environment mode | `development` | `production` |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:4200` | `https://yourdomain.com` |

### Session Security

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SESSION_SECRET` | Secret key for session encryption | **Yes** (production) | `your-super-secret-key` |
| `JWT_SECRET` | Secret key for JWT token signing | **Yes** (production) | `your-jwt-secret-key` |

**⚠️ Important**: In production, use a strong random secret. Generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Google OAuth Configuration

Required for user authentication via Google Sign-In.

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-abc123...` |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL | `https://kolkata-scooty-bike-training-1ild.onrender.com/api/auth/google/callback` |

#### How to Get Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google+ API** (or **Google Identity API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen (if first time)
6. Application type: **Web application**
7. Add **Authorized redirect URIs**:
   - Development: `https://kolkata-scooty-bike-training-1ild.onrender.com/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
8. Copy **Client ID** and **Client Secret** to `.env`

### Email Configuration (SMTP)

Required for sending booking confirmation and cancellation emails.

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) |
| `SMTP_USER` | SMTP username (email) | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP password | `your-app-password` |
| `SMTP_FROM` | From email address | `your-email@gmail.com` |

#### Gmail Setup:

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Use this app password (not your regular password) as `SMTP_PASS`

#### Other Email Providers:

- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom SMTP**: Use your provider's SMTP settings

## Email Service Behavior

- If SMTP configuration is missing, the service will log warnings but continue operating
- Booking emails are sent asynchronously (non-blocking)
- Email failures are logged but don't affect booking creation
- Check server logs for email delivery status

## Production Checklist

Before deploying to production, ensure:

- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` is a strong random string
- [ ] `FRONTEND_URL` points to your production domain
- [ ] `GOOGLE_CALLBACK_URL` uses HTTPS and production domain
- [ ] Database credentials are secure
- [ ] SMTP credentials are configured
- [ ] All sensitive values are not committed to version control

## Security Notes

1. **Never commit `.env` file to version control**
2. Add `.env` to `.gitignore`
3. Use different credentials for development and production
4. Rotate secrets periodically
5. Use environment-specific `.env` files (`.env.development`, `.env.production`)

## Troubleshooting

### Email Not Sending

1. Check SMTP credentials are correct
2. For Gmail: Ensure app password is used (not regular password)
3. Check firewall allows outbound SMTP connections
4. Review server logs for SMTP errors

### Google OAuth Not Working

1. Verify callback URL matches exactly (including http/https)
2. Check Client ID and Secret are correct
3. Ensure Google+ API is enabled
4. Verify redirect URI is added in Google Console

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check database credentials
3. Ensure database exists
4. Verify user has proper permissions

## Example `.env` File

See `.env.example` for a complete template with all variables documented.

