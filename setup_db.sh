#!/bin/bash

# PostgreSQL Database Setup Script for Kolkata Scotty Bike Training
# This script automates the setup of PostgreSQL database, user, and schema
# It is idempotent and can be run multiple times safely

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
SCHEMA_FILE="backend/schema.sql"
POSTGRES_USER="postgres"

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

# Step 1: Check if PostgreSQL is installed
print_info "Step 1: Checking if PostgreSQL is installed..."
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client (psql) is not installed."
    print_info "Please install PostgreSQL using: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi
print_success "PostgreSQL client is installed"

# Step 2: Check if PostgreSQL service is running
print_info "Step 2: Checking if PostgreSQL service is running..."
if ! sudo systemctl is-active --quiet postgresql; then
    print_error "PostgreSQL service is not running."
    print_info "Attempting to start PostgreSQL service..."
    if sudo systemctl start postgresql; then
        print_success "PostgreSQL service started successfully"
    else
        print_error "Failed to start PostgreSQL service. Please start it manually."
        exit 1
    fi
else
    print_success "PostgreSQL service is running"
fi

# Step 3: Check if we can connect to PostgreSQL as postgres user
print_info "Step 3: Verifying PostgreSQL connection..."
if ! sudo -u $POSTGRES_USER psql -c '\q' 2>/dev/null; then
    print_error "Cannot connect to PostgreSQL as $POSTGRES_USER user."
    print_info "Please ensure PostgreSQL is properly configured and accessible."
    exit 1
fi
print_success "PostgreSQL connection verified"

# Step 4: Create database if it doesn't exist
print_info "Step 4: Creating database '$DB_NAME' if it doesn't exist..."
if sudo -u $POSTGRES_USER psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    print_info "Database '$DB_NAME' already exists, skipping creation"
else
    if sudo -u $POSTGRES_USER psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null; then
        print_success "Database '$DB_NAME' created successfully"
    else
        print_error "Failed to create database '$DB_NAME'"
        exit 1
    fi
fi

# Step 5: Create user if it doesn't exist
print_info "Step 5: Creating user '$DB_USER' if it doesn't exist..."
USER_EXISTS=$(sudo -u $POSTGRES_USER psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")
if [ "$USER_EXISTS" = "1" ]; then
    print_info "User '$DB_USER' already exists, updating password..."
    if sudo -u $POSTGRES_USER psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null; then
        print_success "Password for user '$DB_USER' updated successfully"
    else
        print_error "Failed to update password for user '$DB_USER'"
        exit 1
    fi
else
    if sudo -u $POSTGRES_USER psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null; then
        print_success "User '$DB_USER' created successfully"
    else
        print_error "Failed to create user '$DB_USER'"
        exit 1
    fi
fi

# Step 6: Grant privileges on database
print_info "Step 6: Granting privileges on database '$DB_NAME' to user '$DB_USER'..."
if sudo -u $POSTGRES_USER psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null; then
    print_success "Database privileges granted successfully"
else
    print_error "Failed to grant database privileges"
    exit 1
fi

# Grant CREATEDB privilege to allow user to create databases (optional but useful)
if sudo -u $POSTGRES_USER psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null; then
    print_success "CREATEDB privilege granted to user '$DB_USER'"
fi

# Step 7: Grant schema privileges (requires connection to the target database)
print_info "Step 7: Granting schema privileges..."
if sudo -u $POSTGRES_USER psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null && \
   sudo -u $POSTGRES_USER psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>/dev/null && \
   sudo -u $POSTGRES_USER psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;" 2>/dev/null; then
    print_success "Schema privileges granted successfully"
else
    print_error "Failed to grant schema privileges"
    exit 1
fi

# Step 8: Check if schema file exists
print_info "Step 8: Checking if schema file exists..."
if [ ! -f "$SCHEMA_FILE" ]; then
    print_error "Schema file '$SCHEMA_FILE' not found!"
    exit 1
fi
print_success "Schema file found: $SCHEMA_FILE"

# Step 9: Execute schema file
print_info "Step 9: Executing schema file..."
if sudo -u $POSTGRES_USER psql -d $DB_NAME -f "$SCHEMA_FILE" 2>/dev/null; then
    print_success "Schema file executed successfully"
else
    print_error "Failed to execute schema file"
    print_info "Attempting to execute with user '$DB_USER' instead..."
    # Set password for psql non-interactive mode
    export PGPASSWORD=$DB_PASSWORD
    if psql -U $DB_USER -d $DB_NAME -f "$SCHEMA_FILE" 2>/dev/null; then
        print_success "Schema file executed successfully with user '$DB_USER'"
    else
        print_error "Failed to execute schema file with user '$DB_USER'"
        print_info "You may need to run the schema manually:"
        print_info "  psql -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE"
        exit 1
    fi
fi

# Final verification
print_info "Verifying database setup..."
TABLE_COUNT=$(sudo -u $POSTGRES_USER psql -d $DB_NAME -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
if [ "$TABLE_COUNT" -gt "0" ]; then
    print_success "Database setup completed successfully!"
    print_success "Found $TABLE_COUNT table(s) in the database"
    echo ""
    print_info "Database: $DB_NAME"
    print_info "User: $DB_USER"
    print_info "Password: $DB_PASSWORD"
    echo ""
    print_success "You can now connect to the database using:"
    print_info "  psql -U $DB_USER -d $DB_NAME"
else
    print_error "Database setup completed but no tables were found"
    exit 1
fi

