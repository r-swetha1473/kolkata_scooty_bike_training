# PowerShell script to apply PostgreSQL migration
# Usage: .\apply_postgresql_migration.ps1

Write-Host "Applying PostgreSQL migration..." -ForegroundColor Green
Write-Host ""

# Check if backend/node_modules exists
if (Test-Path "backend\node_modules\pg") {
    Write-Host "Using backend's database connection..." -ForegroundColor Cyan
    Set-Location backend
    node apply_migration.js
    Set-Location ..
} elseif (Get-Command psql -ErrorAction SilentlyContinue) {
    $MigrationFile = "supabase\migrations\20250103000000_migrate_to_direct_postgresql.sql"
    $DatabaseUrl = $env:DATABASE_URL
    
    if (-not $DatabaseUrl) {
        Write-Host "Error: DATABASE_URL environment variable is not set." -ForegroundColor Red
        Write-Host "Please set it in your .env file or environment variables." -ForegroundColor Yellow
        exit 1
    }
    
    if (-not (Test-Path $MigrationFile)) {
        Write-Host "Error: Migration file not found: $MigrationFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Using psql..." -ForegroundColor Cyan
    psql $DatabaseUrl -f $MigrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "Migration failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: Neither Node.js backend nor psql found." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please choose one of these options:" -ForegroundColor Yellow
    Write-Host "1. Install backend dependencies:" -ForegroundColor Cyan
    Write-Host "   cd backend && npm install" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Use psql directly:" -ForegroundColor Cyan
    Write-Host "   psql `"`$env:DATABASE_URL`" -f supabase\migrations\20250103000000_migrate_to_direct_postgresql.sql" -ForegroundColor White
    exit 1
}

