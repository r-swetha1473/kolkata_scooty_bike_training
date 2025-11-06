# Kolkata Scotty Backend - Quick Start

## Setup (5 minutes)

### 1. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt install postgresql

# macOS
brew install postgresql@15
```

### 2. Create Database
```bash
sudo -u postgres psql
CREATE DATABASE kolkata_scotty;
CREATE USER scotty_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty_user;
\q
```

### 3. Run Schema
```bash
cd backend
psql -U scotty_user -d kolkata_scotty -f schema.sql
```

### 4. Configure Environment
```bash
# Copy the example file (rename env.example.txt to .env)
cp env.example.txt .env
# Edit .env with your database credentials, Google OAuth keys, and SMTP settings
```

**See [ENV_SETUP.md](./ENV_SETUP.md) for complete environment variable documentation.**

### 5. Install & Run
```bash
npm install
npm run dev
```

Backend runs on `http://localhost:3000`

## Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable Google+ API
3. Credentials → OAuth 2.0 Client ID
4. Add redirect: `http://localhost:3000/api/auth/google/callback`
5. Copy Client ID & Secret to `.env`

## Test It

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/trainers
```

## See Full Documentation

Read `../POSTGRESQL_SETUP.md` for complete guide.

## Deployment

- Heroku: `heroku create && git push heroku main`
- Railway: Import from GitHub
- DigitalOcean: App Platform + PostgreSQL

Your backend is ready! 🚀
