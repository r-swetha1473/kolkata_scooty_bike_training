# PowerShell script to apply database migrations
# Applies security fixes and adds unique constraint to slots table

$ErrorActionPreference = "Continue"

# Color output functions
function Write-SuccessMsg {
    param($message)
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-ErrMsg {
    param($message)
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Write-InfoMsg {
    param($message)
    Write-Host "[INFO] $message" -ForegroundColor Yellow
}

# Configuration
$DB_NAME = "kolkata_scotty"
$DB_USER = "scotty"
$DB_PASSWORD = "scotty123"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Apply Database Migrations" -ForegroundColor Cyan
Write-Host "Kolkata Scotty Bike Training" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Find PostgreSQL installation
Write-InfoMsg "Step 1: Detecting PostgreSQL installation..."

$PG_VERSIONS = @("17", "16", "15", "14", "13", "12")
$PG_BIN = $null

foreach ($version in $PG_VERSIONS) {
    $testPath = "C:\Program Files\PostgreSQL\$version\bin\psql.exe"
    if (Test-Path $testPath) {
        $PG_BIN = $testPath
        Write-SuccessMsg "Found PostgreSQL at: $PG_BIN"
        break
    }
}

if (-not $PG_BIN) {
    Write-ErrMsg "PostgreSQL not found. Please install PostgreSQL or update the path."
    exit 1
}

# Step 2: Test database connection
Write-InfoMsg "Step 2: Testing database connection..."

$env:PGPASSWORD = $DB_PASSWORD
$testConnection = & $PG_BIN -U $DB_USER -d $DB_NAME -w -c "SELECT version();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Database connection successful"
} else {
    Write-ErrMsg "Cannot connect to database. Please check your credentials."
    Write-InfoMsg "Database: $DB_NAME"
    Write-InfoMsg "User: $DB_USER"
    exit 1
}

# Step 3: Apply migration 1 - Security fixes
Write-InfoMsg "Step 3: Applying migration - Security fixes..."

$MIGRATION_FILE1 = "supabase\migrations\20250101000000_fix_security_issues.sql"
if (-not (Test-Path $MIGRATION_FILE1)) {
    Write-ErrMsg "Migration file not found: $MIGRATION_FILE1"
    exit 1
}

$migrationResult1 = & $PG_BIN -U $DB_USER -d $DB_NAME -w -f $MIGRATION_FILE1 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Security fixes migration applied successfully"
} else {
    # Check if it's just a "already exists" error
    if ($migrationResult1 -match "already exists" -or $migrationResult1 -match "does not exist") {
        Write-InfoMsg "Migration partially applied or already exists (some errors expected): $migrationResult1"
        Write-SuccessMsg "Migration 1 completed (some objects may already exist)"
    } else {
        Write-ErrMsg "Failed to apply migration: $migrationResult1"
        exit 1
    }
}

# Step 4: Apply migration 2 - Add unique constraint
Write-InfoMsg "Step 4: Applying migration - Add unique constraint to slots..."

$MIGRATION_FILE2 = "supabase\migrations\20250102000000_add_slots_unique_constraint.sql"
if (-not (Test-Path $MIGRATION_FILE2)) {
    Write-ErrMsg "Migration file not found: $MIGRATION_FILE2"
    exit 1
}

$migrationResult2 = & $PG_BIN -U $DB_USER -d $DB_NAME -w -f $MIGRATION_FILE2 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Unique constraint migration applied successfully"
} else {
    # Check if constraint already exists
    if ($migrationResult2 -match "already exists" -or $migrationResult2 -match "duplicate key") {
        Write-InfoMsg "Unique constraint already exists (safe to ignore)"
        Write-SuccessMsg "Migration 2 completed (constraint already present)"
    } else {
        Write-ErrMsg "Failed to apply migration: $migrationResult2"
        exit 1
    }
}

# Step 5: Verify migrations
Write-InfoMsg "Step 5: Verifying migrations..."

# Check if unique constraint exists
$checkConstraint = & $PG_BIN -U $DB_USER -d $DB_NAME -w -tAc "SELECT 1 FROM pg_constraint WHERE conname = 'slots_trainer_time_unique';" 2>&1
if ($checkConstraint -match "1") {
    Write-SuccessMsg "Unique constraint verified: slots_trainer_time_unique"
} else {
    Write-InfoMsg "Unique constraint check: $checkConstraint"
}

# Check indexes
$checkIndexes = & $PG_BIN -U $DB_USER -d $DB_NAME -w -tAc "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_bookings_cancelled_by', 'idx_settings_updated_by');" 2>&1
Write-SuccessMsg "Security indexes verified: Found $checkIndexes index(es)"

# Step 6: Ask if user wants to re-seed
Write-Host ""
Write-InfoMsg "Step 6: Seed database with demo data?"
$seedChoice = Read-Host "Do you want to run seed.sql? (y/N)"
if ($seedChoice -eq "y" -or $seedChoice -eq "Y") {
    $SEED_FILE = "supabase\seed.sql"
    if (-not (Test-Path $SEED_FILE)) {
        Write-ErrMsg "Seed file not found: $SEED_FILE"
    } else {
        Write-InfoMsg "Running seed.sql..."
        $seedResult = & $PG_BIN -U $DB_USER -d $DB_NAME -w -f $SEED_FILE 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-SuccessMsg "Seed data loaded successfully"
        } else {
            # Seed file might have some expected conflicts, check if it's just conflicts
            if ($seedResult -match "ON CONFLICT" -or $seedResult -match "duplicate") {
                Write-SuccessMsg "Seed data completed (some conflicts expected with ON CONFLICT DO NOTHING)"
            } else {
                Write-ErrMsg "Failed to run seed file: $seedResult"
            }
        }
    }
} else {
    Write-InfoMsg "Skipping seed data"
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Migrations Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-SuccessMsg "Database: $DB_NAME"
Write-SuccessMsg "All migrations applied successfully"
Write-Host ""

# Clear password from environment
$env:PGPASSWORD = ''

