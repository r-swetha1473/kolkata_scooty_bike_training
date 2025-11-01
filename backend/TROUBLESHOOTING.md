# PostgreSQL Setup Troubleshooting

## Error: "relation 'settings' does not exist"

This means the schema wasn't fully applied. Here are solutions:

### Solution 1: Use the Automated Setup Script (Easiest)

```bash
cd backend
./setup.sh
```

This script will:
1. Check PostgreSQL is installed and running
2. Drop and recreate the database (fresh start)
3. Create user with proper permissions
4. Run schema.sql
5. Verify all tables created

### Solution 2: Manual Step-by-Step Fix

#### Step 1: Connect as postgres superuser

```bash
sudo -u postgres psql
```

#### Step 2: Drop and recreate database

```sql
-- Drop existing (if any issues)
DROP DATABASE IF EXISTS kolkata_scotty;
DROP USER IF EXISTS scotty;

-- Create fresh
CREATE DATABASE kolkata_scotty;
CREATE USER scotty WITH PASSWORD 'scotty123';
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty;

-- Connect to the new database
\c kolkata_scotty

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO scotty;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO scotty;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO scotty;

-- Exit
\q
```

#### Step 3: Run schema as the scotty user

```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -f schema.sql
```

#### Step 4: Verify all tables exist

```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "\dt"
```

You should see:
```
 Schema |    Name     | Type  | Owner
--------+-------------+-------+-------
 public | audit_logs  | table | scotty
 public | bookings    | table | scotty
 public | profiles    | table | scotty
 public | settings    | table | scotty
 public | slots       | table | scotty
 public | trainers    | table | scotty
(6 rows)
```

### Solution 3: Check for Errors During Schema Run

Run the schema with verbose error output:

```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -f schema.sql -v ON_ERROR_STOP=1
```

This will stop at the first error and show you what failed.

## Common Issues

### Issue 1: Permission Denied

**Error:**
```
ERROR:  permission denied for schema public
```

**Fix:**
```bash
sudo -u postgres psql -d kolkata_scotty -c "GRANT ALL ON SCHEMA public TO scotty;"
```

### Issue 2: UUID Extension Not Installed

**Error:**
```
ERROR:  type "uuid" does not exist
```

**Fix:**
```bash
sudo -u postgres psql -d kolkata_scotty -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### Issue 3: Database Doesn't Exist

**Error:**
```
psql: error: connection to server failed: FATAL: database "kolkata_scotty" does not exist
```

**Fix:**
```bash
sudo -u postgres psql -c "CREATE DATABASE kolkata_scotty;"
```

### Issue 4: User Doesn't Exist

**Error:**
```
psql: error: connection to server failed: FATAL: role "scotty" does not exist
```

**Fix:**
```bash
sudo -u postgres psql -c "CREATE USER scotty WITH PASSWORD 'scotty123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty;"
```

### Issue 5: PostgreSQL Not Running

**Error:**
```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory
```

**Fix:**
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew services start postgresql@15

# Check status
pg_isready
```

### Issue 6: Can't Connect to PostgreSQL

**Check if it's listening:**
```bash
sudo netstat -plunt | grep 5432
```

**If not, check PostgreSQL config:**
```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
# Ensure: listen_addresses = 'localhost'

sudo systemctl restart postgresql
```

## Verification Commands

### Check if PostgreSQL is installed
```bash
psql --version
```

### Check if PostgreSQL is running
```bash
pg_isready
# or
sudo systemctl status postgresql
```

### List all databases
```bash
sudo -u postgres psql -c "\l"
```

### List all users
```bash
sudo -u postgres psql -c "\du"
```

### Connect to database
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty
```

### Check tables
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "\dt"
```

### Count rows in each table
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty << SQL
SELECT 'profiles' as table, COUNT(*) as rows FROM profiles
UNION ALL
SELECT 'trainers', COUNT(*) FROM trainers
UNION ALL
SELECT 'slots', COUNT(*) FROM slots
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'settings', COUNT(*) FROM settings;
SQL
```

## Complete Fresh Start

If nothing works, do a complete reset:

```bash
# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Remove data (DANGER: Deletes all databases!)
sudo rm -rf /var/lib/postgresql/*/main

# 3. Reinstall PostgreSQL
sudo apt remove postgresql postgresql-contrib
sudo apt autoremove
sudo apt install postgresql postgresql-contrib

# 4. Start PostgreSQL
sudo systemctl start postgresql

# 5. Run automated setup
cd backend
./setup.sh
```

## Testing the Connection

### Test 1: Basic Connection
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "SELECT NOW();"
```

Should return current timestamp.

### Test 2: Check Tables
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty -c "\dt"
```

Should list 6 tables.

### Test 3: Test Insert
```bash
PGPASSWORD=scotty123 psql -U scotty -d kolkata_scotty << SQL
INSERT INTO profiles (email, full_name, role)
VALUES ('test@example.com', 'Test User', 'customer')
RETURNING *;
SQL
```

Should return the inserted row.

## Still Having Issues?

### Check PostgreSQL Logs

**Ubuntu/Debian:**
```bash
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

**macOS:**
```bash
tail -f /usr/local/var/log/postgres.log
```

### Get Help

1. Check PostgreSQL version: `psql --version`
2. Check OS: `uname -a`
3. Share error message
4. Share output of: `sudo systemctl status postgresql`

## Alternative: Use Docker PostgreSQL

If local PostgreSQL is problematic, use Docker:

```bash
# Pull PostgreSQL image
docker pull postgres:15

# Run PostgreSQL container
docker run --name kolkata-postgres \
  -e POSTGRES_DB=kolkata_scotty \
  -e POSTGRES_USER=scotty \
  -e POSTGRES_PASSWORD=scotty123 \
  -p 5432:5432 \
  -d postgres:15

# Wait for it to start
sleep 5

# Run schema
docker exec -i kolkata-postgres psql -U scotty -d kolkata_scotty < backend/schema.sql

# Verify
docker exec -it kolkata-postgres psql -U scotty -d kolkata_scotty -c "\dt"
```

Your `.env` stays the same:
```
DATABASE_URL=postgresql://scotty:scotty123@localhost:5432/kolkata_scotty
```

## Success Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `kolkata_scotty` created
- [ ] User `scotty` created with password
- [ ] Schema.sql ran without errors
- [ ] All 6 tables exist (profiles, trainers, slots, bookings, audit_logs, settings)
- [ ] Can connect: `psql -U scotty -d kolkata_scotty`
- [ ] Backend server starts: `npm run dev`
- [ ] Health check works: `curl http://localhost:3000/health`

Once all checked, your PostgreSQL backend is ready! 🎉
