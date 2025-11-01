# Windows PostgreSQL Setup Guide

This guide will help you set up PostgreSQL on Windows for the Kolkata Scotty Bike Training application.

## Step 1: Install PostgreSQL on Windows

### Option A: Using PostgreSQL Installer (Recommended)

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
   - Choose the Windows x86-64 installer
   - Latest version (PostgreSQL 15 or 16)

2. Run the installer:
   - **Installation Directory**: Leave default (`C:\Program Files\PostgreSQL\15`)
   - **Data Directory**: Leave default
   - **Password**: Set a password for the `postgres` superuser (remember this!)
   - **Port**: Leave default (5432)
   - **Advanced Options**: Leave defaults
   - **Stack Builder**: Uncheck if you don't need additional tools

3. After installation:
   - PostgreSQL service will start automatically
   - You can verify it's running in Services (`services.msc`) - look for "postgresql-x64-15"

### Option B: Using Chocolatey

If you have Chocolatey installed:
```powershell
choco install postgresql15
```

## Step 2: Add PostgreSQL to PATH (Optional but Recommended)

1. Open System Properties:
   - Press `Win + X` → System → Advanced system settings
   - Or search "Environment Variables" in Start menu

2. Edit PATH variable:
   - Under "System variables", find `Path` and click Edit
   - Add: `C:\Program Files\PostgreSQL\15\bin`
   - Click OK on all dialogs

3. Verify in PowerShell:
```powershell
psql --version
```

## Step 3: Create Database and User

### Using psql (Command Line)

1. Open PowerShell as Administrator (optional, but may be needed)

2. Connect to PostgreSQL:
```powershell
# If PostgreSQL is in PATH:
psql -U postgres

# If not in PATH, use full path:
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres
```

3. When prompted, enter the password you set during installation

4. Run these SQL commands:
```sql
CREATE DATABASE kolkata_scotty;
CREATE USER scotty WITH PASSWORD 'scotty123';
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty;
ALTER USER scotty CREATEDB;
\q
```

### Using pgAdmin (GUI Tool)

1. Open pgAdmin (installed with PostgreSQL)
   - Usually accessible from Start menu or: `C:\Program Files\PostgreSQL\15\pgAdmin 4\bin\pgAdmin4.exe`

2. Connect to server:
   - Enter password when prompted (the one you set during installation)

3. Create Database:
   - Right-click "Databases" → Create → Database
   - Name: `kolkata_scotty`
   - Owner: `postgres`
   - Click Save

4. Create User:
   - Expand "Login/Group Roles"
   - Right-click → Create → Login/Group Role
   - General tab: Name = `scotty`
   - Definition tab: Password = `scotty123`
   - Privileges tab: Check "Can login?" and "Create databases"
   - Click Save

5. Grant Permissions:
   - Right-click `kolkata_scotty` database → Properties → Security
   - Click "+" to add privilege
   - Grantee: `scotty`
   - Privileges: Select all
   - Click Save

## Step 4: Run Database Schema

1. Open PowerShell and navigate to the project:
```powershell
cd d:\Anna_Swetha\OWN_PROJECTS\project\biketraining\backend
```

2. Run the schema:
```powershell
# If psql is in PATH:
psql -U scotty -d kolkata_scotty -f schema.sql

# If not in PATH:
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U scotty -d kolkata_scotty -f schema.sql
```

3. Enter password when prompted: `scotty123`

4. Verify tables were created:
```powershell
psql -U scotty -d kolkata_scotty -c "\dt"
```

You should see tables: profiles, trainers, slots, bookings, audit_logs, settings

## Step 5: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Create a new project (or select existing)

3. Enable Google+ API:
   - APIs & Services → Library
   - Search "Google+ API" and enable it

4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: Kolkata Scotty
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Click Create

5. Copy Client ID and Client Secret

6. Update `backend/.env` file:
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

## Step 6: Start the Backend

```powershell
cd d:\Anna_Swetha\OWN_PROJECTS\project\biketraining\backend
npm run dev
```

You should see: `Server running on port 3000`

## Step 7: Start the Frontend

Open a new PowerShell window:

```powershell
cd d:\Anna_Swetha\OWN_PROJECTS\project\biketraining
npm start
```

The app will open at: `http://localhost:4200`

## Troubleshooting

### PostgreSQL service not running

```powershell
# Check service status
Get-Service postgresql*

# Start service if stopped
Start-Service postgresql-x64-15
```

### Can't connect to database

1. Verify PostgreSQL is running:
```powershell
Get-Service postgresql*
```

2. Check connection string in `backend/.env`:
```
DATABASE_URL=postgresql://scotty:scotty123@localhost:5432/kolkata_scotty
```

3. Test connection:
```powershell
psql -U scotty -d kolkata_scotty -c "SELECT NOW();"
```

### Port 5432 already in use

If you have another PostgreSQL instance:
1. Change port in PostgreSQL config: `C:\Program Files\PostgreSQL\15\data\postgresql.conf`
2. Update `DATABASE_URL` in `.env` to use the new port

### Permission denied errors

Make sure the `scotty` user has proper permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE kolkata_scotty TO scotty;
GRANT ALL ON SCHEMA public TO scotty;
```

## Next Steps

1. ✅ Backend is running on port 3000
2. ✅ Frontend is running on port 4200
3. ✅ Test the API: `http://localhost:3000/health`
4. ✅ Test Google OAuth login
5. ✅ Create your first booking!

For more details, see `POSTGRESQL_BACKEND_READY.md` and `POSTGRESQL_SETUP.md`.

