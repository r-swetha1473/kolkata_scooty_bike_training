# Quick Fix: "relation 'settings' does not exist"

## The Problem

The schema.sql didn't run completely. The `settings` table wasn't created.

## Quick Fix (30 seconds)

### Option 1: Use the Setup Script (Easiest)

```bash
cd backend
chmod +x setup.sh
./setup.sh
```

Done! This recreates everything fresh.

### Option 2: Manual Fix (1 minute)

```bash
# 1. Connect as postgres superuser
sudo -u postgres psql

# 2. In the PostgreSQL shell, run:
DROP DATABASE IF EXISTS kolkata_scotty;
CREATE DATABASE kolkata_scotty;
\c kolkata_scotty
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q

# 3. Grant permissions
sudo -u postgres psql -d kolkata_scotty << SQL
GRANT ALL ON SCHEMA public TO scotty;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO scotty;
SQL

# 4. Run schema as scotty user
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -f schema.sql

# 5. Verify
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "\dt"
```

You should see all 6 tables:
- audit_logs
- bookings
- profiles
- settings ✅
- slots
- trainers

## Why It Happened

Common causes:
1. **Permission issues** - User didn't have rights to create tables
2. **UUID extension missing** - PostgreSQL needs uuid-ossp extension
3. **Previous failed attempt** - Partially created schema

## Verify It's Fixed

```bash
# Check settings table exists
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "SELECT COUNT(*) FROM settings;"
```

Should return `0` (empty table) without errors.

## Start Your Backend

```bash
cd backend
npm install  # if not done already
npm run dev
```

Should see:
```
Server running on port 3000
Environment: development
```

## Test It Works

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

## Still Getting Errors?

See `TROUBLESHOOTING.md` for detailed solutions.

Your backend is ready! 🚀
