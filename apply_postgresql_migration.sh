#!/bin/bash
# Bash script to apply PostgreSQL migration
# Usage: ./apply_postgresql_migration.sh

MIGRATION_FILE="${1:-supabase/migrations/20250103000000_migrate_to_direct_postgresql.sql}"
DATABASE_URL="${DATABASE_URL}"

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
    else
        echo "✗ Migration failed!"
        exit 1
    fi
else
    echo "psql not found. Please install PostgreSQL client tools."
    echo "Or use the Node.js migration script:"
    echo "  node apply_postgresql_migration.js"
    exit 1
fi



