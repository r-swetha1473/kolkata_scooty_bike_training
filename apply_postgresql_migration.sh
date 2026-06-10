#!/bin/bash
# Bash script to apply PostgreSQL migration
# Usage: ./apply_postgresql_migration.sh

MIGRATION_FILE="${1:-supabase/migrations/20250103000000_migrate_to_direct_postgresql.sql}"
DATABASE_URL="${DATABASE_URL}"

# Check if Node.js backend is available
if [ -d "backend/node_modules" ] && [ -f "backend/apply_migration.js" ]; then
    echo "Using backend's database connection..."
    echo ""
    cd backend
    node apply_migration.js
    EXIT_CODE=$?
    cd ..
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Setup Complete!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Log in with the admin email and password you passed to create_admin.js"
        echo "  (or ADMIN_EMAIL / ADMIN_PASSWORD from your environment)."
        echo ""
        echo "⚠️  IMPORTANT: Use a strong password and change it after first login!"
        echo ""
    else
        echo "Migration completed with warnings. Check output above."
    fi
    exit $EXIT_CODE
fi

# Fallback to psql if Node.js backend not available
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set."
    echo "Please set it or pass it as a parameter:"
    echo "  DATABASE_URL='postgresql://user:password@localhost:5432/dbname' ./apply_postgresql_migration.sh"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Applying migration: $MIGRATION_FILE"
echo "Database: ${DATABASE_URL/\/\/.*@/\/\/****@}"

if command -v psql &> /dev/null; then
    psql "$DATABASE_URL" -f "$MIGRATION_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✓ Migration applied successfully!"
        echo ""
        echo "To create admin user, run:"
        echo "  cd backend && npm install && node create_admin.js"
        echo ""
    else
        echo "✗ Migration failed!"
        exit 1
    fi
else
    echo "psql not found. Please install PostgreSQL client tools."
    echo "Or install backend dependencies and use:"
    echo "  cd backend && npm install && node apply_migration.js"
    exit 1
fi







