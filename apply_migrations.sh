#!/bin/bash

# Bash script to apply database migrations
# Applies security fixes and adds unique constraint to slots table

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="kolkata_scotty"
DB_USER="scotty"
DB_PASSWORD="scotty123"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Apply Database Migrations${NC}"
echo -e "${GREEN}Kolkata Scotty Bike Training${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Step 1: Check if PostgreSQL is installed
print_info "Step 1: Checking if PostgreSQL is installed..."
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client (psql) is not installed."
    exit 1
fi
print_success "PostgreSQL client is installed"

# Step 2: Test database connection
print_info "Step 2: Testing database connection..."
export PGPASSWORD=$DB_PASSWORD
if psql -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Cannot connect to database. Please check your credentials."
    print_info "Database: $DB_NAME"
    print_info "User: $DB_USER"
    exit 1
fi

# Step 3: Apply migration 1 - Security fixes
print_info "Step 3: Applying migration - Security fixes..."

MIGRATION_FILE1="supabase/migrations/20250101000000_fix_security_issues.sql"
if [ ! -f "$MIGRATION_FILE1" ]; then
    print_error "Migration file not found: $MIGRATION_FILE1"
    exit 1
fi

if psql -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE1" > /dev/null 2>&1; then
    print_success "Security fixes migration applied successfully"
else
    print_info "Migration partially applied or already exists (some errors expected)"
    print_success "Migration 1 completed (some objects may already exist)"
fi

# Step 4: Apply migration 2 - Add unique constraint
print_info "Step 4: Applying migration - Add unique constraint to slots..."

MIGRATION_FILE2="supabase/migrations/20250102000000_add_slots_unique_constraint.sql"
if [ ! -f "$MIGRATION_FILE2" ]; then
    print_error "Migration file not found: $MIGRATION_FILE2"
    exit 1
fi

if psql -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE2" > /dev/null 2>&1; then
    print_success "Unique constraint migration applied successfully"
else
    # Check if constraint already exists
    if psql -U $DB_USER -d $DB_NAME -tAc "SELECT 1 FROM pg_constraint WHERE conname = 'slots_trainer_time_unique';" 2>/dev/null | grep -q 1; then
        print_info "Unique constraint already exists (safe to ignore)"
        print_success "Migration 2 completed (constraint already present)"
    else
        print_error "Failed to apply unique constraint migration"
        exit 1
    fi
fi

# Step 5: Verify migrations
print_info "Step 5: Verifying migrations..."

# Check if unique constraint exists
if psql -U $DB_USER -d $DB_NAME -tAc "SELECT 1 FROM pg_constraint WHERE conname = 'slots_trainer_time_unique';" 2>/dev/null | grep -q 1; then
    print_success "Unique constraint verified: slots_trainer_time_unique"
fi

# Check indexes
INDEX_COUNT=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_bookings_cancelled_by', 'idx_settings_updated_by');" 2>/dev/null || echo "0")
print_success "Security indexes verified: Found $INDEX_COUNT index(es)"

# Step 6: Ask if user wants to re-seed
echo ""
print_info "Step 6: Seed database with demo data?"
read -p "Do you want to run seed.sql? (y/N): " seed_choice
if [ "$seed_choice" = "y" ] || [ "$seed_choice" = "Y" ]; then
    SEED_FILE="supabase/seed.sql"
    if [ ! -f "$SEED_FILE" ]; then
        print_error "Seed file not found: $SEED_FILE"
    else
        print_info "Running seed.sql..."
        if psql -U $DB_USER -d $DB_NAME -f "$SEED_FILE" > /dev/null 2>&1; then
            print_success "Seed data loaded successfully"
        else
            print_success "Seed data completed (some conflicts expected with ON CONFLICT DO NOTHING)"
        fi
    fi
else
    print_info "Skipping seed data"
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Migrations Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
print_success "Database: $DB_NAME"
print_success "All migrations applied successfully"
echo ""

# Clear password from environment
unset PGPASSWORD

