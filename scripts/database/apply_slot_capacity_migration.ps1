# Apply slot capacity constraint migration and verify via API.
# Usage (from repo root):
#   $env:DATABASE_URL = "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
#   .\scripts\database\apply_slot_capacity_migration.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = if (Test-Path "backend\apply_migration.js") { Get-Location } else { Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
Set-Location $RepoRoot

if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: Set DATABASE_URL to your Neon connection string." -ForegroundColor Red
    exit 1
}

$Migration = "supabase\migrations\20260610140000_slot_capacity_sum_limit.sql"
if (-not (Test-Path $Migration)) {
    Write-Host "ERROR: Migration not found: $Migration" -ForegroundColor Red
    exit 1
}

Write-Host "1. Inspecting constraint (before)..." -ForegroundColor Cyan
Set-Location backend
node scripts/apply_slot_capacity_migration.js
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) { exit $LASTEXITCODE }

Write-Host "`n2. Applying migration..." -ForegroundColor Cyan
$env:APPLY_MIGRATION = "1"
node scripts/apply_slot_capacity_migration.js
$ApplyExit = $LASTEXITCODE

Write-Host "`n3. Post-migration verification (includes API recalc)..." -ForegroundColor Cyan
node scripts/verify_slots_production.js

exit $ApplyExit
