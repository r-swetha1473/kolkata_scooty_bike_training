# Migration Guide - Running Database Migrations

## Quick Start (Recommended)

### Option 1: Using Node.js Script (Easiest)

This method uses your existing database configuration from `backend/.env`:

```powershell
# Navigate to backend directory
cd backend

# Run the migration
node apply_migration.js ../supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
```

**Or simply:**
```powershell
cd backend
node apply_migration.js
```
(It will automatically use the latest migration file)

---

### Option 2: Using PowerShell Script

```powershell
# From project root directory
.\apply_postgresql_migration.ps1
```

**Note:** You need to set `DATABASE_URL` environment variable first:
```powershell
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/database_name"
.\apply_postgresql_migration.ps1
```

---

### Option 3: Using psql Directly

If you have PostgreSQL client tools installed:

```powershell
# Set your database connection string
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/database_name"

# Run the migration
psql $env:DATABASE_URL -f supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
```

**Or with individual connection parameters:**
```powershell
psql -h localhost -p 5432 -U your_username -d your_database -f supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
```

---

## Detailed Instructions

### Prerequisites

1. **Database Connection**: Make sure your database is running and accessible
2. **Environment Variables**: Set up your database connection in `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_username
   DB_PASSWORD=your_password
   
   # OR use connection string:
   # DATABASE_URL=postgresql://user:password@localhost:5432/database_name
   ```

### Step-by-Step: Using Node.js (Recommended)

1. **Open PowerShell/Terminal** in the project root

2. **Navigate to backend directory:**
   ```powershell
   cd backend
   ```

3. **Make sure dependencies are installed:**
   ```powershell
   npm install
   ```

4. **Run the migration:**
   ```powershell
   node apply_migration.js ../supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
   ```

5. **Check for success message:**
   ```
   ✓ Migration applied successfully!
   ```

### Step-by-Step: Using psql Directly

1. **Open PowerShell**

2. **Set your database connection:**
   ```powershell
   $env:PGPASSWORD = "your_password"
   ```

3. **Run the migration:**
   ```powershell
   psql -h localhost -p 5432 -U your_username -d your_database_name -f supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
   ```

   **Or with connection string:**
   ```powershell
   $env:DATABASE_URL = "postgresql://user:password@localhost:5432/database_name"
   psql $env:DATABASE_URL -f supabase/migrations/20250105000000_kolkata_scooty_requirements.sql
   ```

---

## Troubleshooting

### Error: "Migration file not found"
- Make sure you're in the correct directory
- Check that the file exists: `supabase/migrations/20250105000000_kolkata_scooty_requirements.sql`

### Error: "Connection refused" or "Database not found"
- Verify your database is running
- Check your connection credentials in `backend/.env`
- Test connection: `psql -h localhost -U your_username -d your_database`

### Error: "Permission denied"
- Make sure your database user has CREATE, ALTER, and DROP privileges
- For PostgreSQL, you might need to run as superuser or grant permissions

### Error: "Column already exists" or "Constraint already exists"
- This is normal for idempotent migrations
- The migration will skip already-existing objects
- Check the output for "Migration applied successfully" message

### Error: "Node.js not found"
- Install Node.js from https://nodejs.org/
- Or use psql directly (Option 3)

---

## Verification

After running the migration, verify it worked:

```sql
-- Check if new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('total_bookings', 'weekly_booking_count', 'phone');

-- Check if vehicles were created
SELECT name, type, vehicle_subtype FROM vehicles;

-- Check if functions were created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('check_weekly_booking_limit', 'increment_weekly_booking_count');
```

---

## What the Migration Does

The migration `20250105000000_kolkata_scooty_requirements.sql` will:

1. ✅ Make phone number unique and required for customers
2. ✅ Add weekly booking tracking fields
3. ✅ Create vehicle subtypes (Electric Scooty, Petrol Scooty, Bike)
4. ✅ Add slot visibility tracking (24-hour rule)
5. ✅ Add cancellation deadline tracking (5-hour rule)
6. ✅ Enforce max capacity of 5 per slot
7. ✅ Create helper functions for booking limits
8. ✅ Insert default vehicles (3 Electric, 1 Petrol, 1 Bike)
9. ✅ Create triggers for automatic updates

---

## Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Verify your database connection settings
3. Make sure PostgreSQL is running
4. Check that you have the necessary permissions




