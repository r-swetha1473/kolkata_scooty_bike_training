# Apply ALL schema migrations to Neon/PostgreSQL in the correct order.
# Usage (from repo root):
#   $env:DATABASE_URL = "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
#   .\scripts\database\apply_all_migrations.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path "$RepoRoot\backend\apply_migration.js")) {
    $RepoRoot = Split-Path $PSScriptRoot -Parent
}
Set-Location $RepoRoot

if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: Set DATABASE_URL to your Neon connection string first." -ForegroundColor Red
    Write-Host '  $env:DATABASE_URL = "postgresql://..."' -ForegroundColor Yellow
    exit 1
}

# IMPORTANT: init_schema MUST run before 202501* files (filename sort is wrong).
$Migrations = @(
    "supabase/migrations/20251102124908_init_schema.sql",
    "supabase/migrations/20250101000000_fix_security_issues.sql",
    "supabase/migrations/20250102000000_add_slots_unique_constraint.sql",
    "supabase/migrations/20250103000000_migrate_to_direct_postgresql.sql",
    "supabase/migrations/20250104000000_enhance_booking_system.sql",
    "supabase/migrations/20250105000000_kolkata_scooty_requirements.sql",
    "supabase/migrations/20260116000100_enforce_slot_schema.sql",
    "supabase/migrations/20260117000000_create_student_recognition.sql",
    "supabase/migrations/20260118000000_create_student_entitlements.sql",
    "supabase/migrations/20260119000000_add_vehicle_capacity_columns.sql",
    "supabase/migrations/20260120000000_phase2_vehicle_based_bookings.sql",
    "supabase/migrations/20260121000000_phase4_admin_audit_log.sql",
    "supabase/migrations/20260122000000_phase5_phone_unique_constraint.sql",
    "supabase/migrations/20260123000000_refactor_vehicles_table.sql",
    "supabase/migrations/20260124000000_create_slot_vehicle_capacity.sql",
    "supabase/migrations/20260125000000_create_ratings_table.sql",
    "supabase/migrations/20260125000001_add_first_booking_date.sql",
    "supabase/migrations/20260125000002_add_performance_indexes.sql",
    "supabase/migrations/20260125000003_create_admins_table.sql",
    "supabase/migrations/20260125000004_fix_slot_vehicle_capacity_schema.sql",
    "supabase/migrations/20260321000000_drop_slots_capacity_eq5_constraint.sql",
    "supabase/migrations/20260321120000_bookings_unique_slot_trainer.sql",
    "supabase/migrations/20260321140000_add_bookings_phone_column.sql",
    "supabase/migrations/20260406000000_profile_inactive_blocked.sql",
    "supabase/migrations/20260407120000_production_schema_safety_net.sql",
    "supabase/migrations/20260609120000_phase2_rbac_subadmin.sql",
    "supabase/migrations/20260609130000_admin_password_management.sql",
    "supabase/migrations/20260609140000_auto_slot_capacity_setting.sql",
    "supabase/migrations/20260609150000_admin_notifications.sql"
)

Write-Host "Applying $($Migrations.Count) migrations to Neon..." -ForegroundColor Cyan
Set-Location backend

foreach ($file in $Migrations) {
    $path = Join-Path $RepoRoot $file
    if (-not (Test-Path $path)) {
        Write-Host "SKIP (missing): $file" -ForegroundColor Yellow
        continue
    }
    Write-Host "`n>> $file" -ForegroundColor Green
    node apply_migration.js $path --skip-admin
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`nAll migrations applied." -ForegroundColor Green
Write-Host "Create admin: cd backend && node create_admin.js" -ForegroundColor Yellow
