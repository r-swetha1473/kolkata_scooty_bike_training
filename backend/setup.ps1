Write-Host "=== PostgreSQL Database Setup (Windows) ===" -ForegroundColor Cyan

# Configuration
$DB_NAME = "kolkata_scotty"
$DB_USER = "scotty"
$DB_PASS = "scotty123"
$SCHEMA_FILE = "schema.sql"

# Check if psql exists
$psqlPath = (Get-Command psql.exe -ErrorAction SilentlyContinue)
if (-not $psqlPath) {
    Write-Host "Error: PostgreSQL not found in PATH." -ForegroundColor Red
    Write-Host "Tip: Add PostgreSQL bin folder to PATH (e.g., C:\Program Files\PostgreSQL\17\bin)."
    exit 1
}

# Create Database and User
Write-Host "Creating database and user..."
cmd /c "psql -U postgres -c `"CREATE DATABASE $DB_NAME;`""
cmd /c "psql -U postgres -c `"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';`""
cmd /c "psql -U postgres -c `"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;`""

# Apply schema
Write-Host "Applying schema file..."
cmd /c "psql -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE"

Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
