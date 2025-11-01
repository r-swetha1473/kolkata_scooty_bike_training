# PowerShell script to create database and run schema
# Idempotent - safe to run multiple times
# Auto-detects PostgreSQL installation

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
$SCHEMA_FILE = "backend\schema.sql"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Database Setup" -ForegroundColor Cyan
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

# Step 2: Test PostgreSQL connection
Write-InfoMsg "Step 2: Testing PostgreSQL connection..."

# Check for password in environment variable or command line parameter
$POSTGRES_PASSWORD = $env:POSTGRES_PASSWORD
if ($null -ne $args[0] -and $args[0] -ne "") {
    $POSTGRES_PASSWORD = $args[0]
}

$testConnection = & $PG_BIN -U postgres -d postgres -w -c "SELECT version();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "PostgreSQL connection successful (using Windows authentication)"
} else {
    # Try with password if provided
    if ($POSTGRES_PASSWORD) {
        Write-InfoMsg "Trying connection with provided password..."
        $env:PGPASSWORD = $POSTGRES_PASSWORD
        $testConnection = & $PG_BIN -U postgres -d postgres -w -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-SuccessMsg "PostgreSQL connection successful"
        } else {
            Write-ErrMsg "Cannot connect to PostgreSQL with provided password."
            Write-InfoMsg "Please check your password or run the script interactively:"
            Write-InfoMsg "  powershell -File setup_db.ps1"
            exit 1
        }
    } else {
        # Try interactive password prompt as last resort
        Write-InfoMsg "Connection test failed. Please enter PostgreSQL 'postgres' user password:"
        try {
            $postgresPassword = Read-Host "Password" -AsSecureString
            $postgresPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($postgresPassword)
            )
            $env:PGPASSWORD = $postgresPasswordPlain
            $testConnection = & $PG_BIN -U postgres -d postgres -w -c "SELECT version();" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-SuccessMsg "PostgreSQL connection successful"
            } else {
                Write-ErrMsg "Cannot connect to PostgreSQL. Please check your password."
                exit 1
            }
        } catch {
            Write-ErrMsg "Cannot connect to PostgreSQL."
            Write-InfoMsg "You can provide the password in one of these ways:"
            Write-InfoMsg "  1. Set environment variable: `$env:POSTGRES_PASSWORD='your_password'; .\setup_db.ps1"
            Write-InfoMsg "  2. Pass as argument: .\setup_db.ps1 your_password"
            Write-InfoMsg "  3. Or ensure Windows authentication is configured for PostgreSQL"
            exit 1
        }
    }
}

# Step 3: Check if database exists
Write-InfoMsg "Step 3: Checking if database '$DB_NAME' exists..."

$dbExists = & $PG_BIN -U postgres -d postgres -w -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" 2>&1

if ($dbExists -match "1") {
    Write-InfoMsg "Database '$DB_NAME' already exists, skipping creation"
} else {
    Write-InfoMsg "Creating database '$DB_NAME'..."
    $createDb = & $PG_BIN -U postgres -d postgres -w -c "CREATE DATABASE $DB_NAME;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-SuccessMsg "Database '$DB_NAME' created successfully"
    } else {
        Write-ErrMsg "Failed to create database: $createDb"
        exit 1
    }
}

# Step 4: Check if user exists
Write-InfoMsg "Step 4: Checking if user '$DB_USER' exists..."

$userExists = & $PG_BIN -U postgres -d postgres -w -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER';" 2>&1

if ($userExists -match "1") {
    Write-InfoMsg "User '$DB_USER' already exists, updating password..."
    $updateUser = & $PG_BIN -U postgres -d postgres -w -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-SuccessMsg "Password for user '$DB_USER' updated successfully"
    } else {
        Write-ErrMsg "Failed to update password: $updateUser"
        exit 1
    }
} else {
    Write-InfoMsg "Creating user '$DB_USER'..."
    $createUser = & $PG_BIN -U postgres -d postgres -w -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-SuccessMsg "User '$DB_USER' created successfully"
    } else {
        Write-ErrMsg "Failed to create user: $createUser"
        exit 1
    }
}

# Step 5: Grant database privileges
Write-InfoMsg "Step 5: Granting database privileges..."

$grantDb = & $PG_BIN -U postgres -d postgres -w -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER; ALTER USER $DB_USER CREATEDB;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Database privileges granted successfully"
} else {
    Write-ErrMsg "Failed to grant database privileges: $grantDb"
    exit 1
}

# Step 6: Grant schema privileges
Write-InfoMsg "Step 6: Granting schema privileges..."

$grantSchema = @"
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
"@

$grantResult = $grantSchema | & $PG_BIN -U postgres -d $DB_NAME -w 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Schema privileges granted successfully"
} else {
    Write-InfoMsg "Some privilege grants may have failed (may already be set): $grantResult"
}

# Step 7: Check schema file
Write-InfoMsg "Step 7: Checking schema file..."

if (-not (Test-Path $SCHEMA_FILE)) {
    Write-ErrMsg "Schema file not found at: $SCHEMA_FILE"
    exit 1
}
Write-SuccessMsg "Schema file found: $SCHEMA_FILE"

# Step 8: Execute schema file
Write-InfoMsg "Step 8: Executing schema file..."

$env:PGPASSWORD = $DB_PASSWORD
$schemaResult = & $PG_BIN -U $DB_USER -d $DB_NAME -w -f $SCHEMA_FILE 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-SuccessMsg "Schema file executed successfully"
} else {
    # Try with postgres user as fallback
    Write-InfoMsg "Attempting with postgres user as fallback..."
    $schemaResult = & $PG_BIN -U postgres -d $DB_NAME -w -f $SCHEMA_FILE 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-SuccessMsg "Schema file executed successfully"
    } else {
        Write-ErrMsg "Failed to execute schema file: $schemaResult"
        exit 1
    }
}

# Step 9: Verify setup
Write-InfoMsg "Step 9: Verifying database setup..."

$tableCount = & $PG_BIN -U postgres -d $DB_NAME -w -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
if ($tableCount -match "^\d+$" -and [int]$tableCount -gt 0) {
    Write-SuccessMsg "Database setup completed successfully!"
    Write-SuccessMsg "Found $tableCount table(s) in the database"
} else {
    Write-ErrMsg "Database setup completed but verification failed"
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database: $DB_NAME" -ForegroundColor White
Write-Host "User: $DB_USER" -ForegroundColor White
Write-Host "Password: $DB_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "Connection String:" -ForegroundColor Cyan
Write-Host "postgresql://$DB_USER`:$DB_PASSWORD@localhost:5432/$DB_NAME" -ForegroundColor White
Write-Host ""

# Clear password from environment
$env:PGPASSWORD = ''
