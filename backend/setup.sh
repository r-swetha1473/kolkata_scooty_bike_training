#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== PostgreSQL Database Setup ===${NC}\n"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL is not installed${NC}"
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt install postgresql"
    echo "  macOS: brew install postgresql@15"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${YELLOW}PostgreSQL is not running. Starting it...${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start postgresql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql@15
    fi
    sleep 2
fi

# Database details
DB_NAME="kolkata_scotty"
DB_USER="scotty"
DB_PASS="scotty123"

echo -e "${GREEN}Step 1: Creating database and user...${NC}"

# Create database and user
sudo -u postgres psql << SQL
-- Drop existing database if exists (BE CAREFUL!)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create fresh database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to the database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
SQL

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database and user created${NC}\n"
else
    echo -e "${RED}✗ Failed to create database${NC}"
    exit 1
fi

echo -e "${GREEN}Step 2: Running schema...${NC}"

# Run schema
PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -f schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Schema created${NC}\n"
else
    echo -e "${RED}✗ Failed to create schema${NC}"
    exit 1
fi

echo -e "${GREEN}Step 3: Verifying tables...${NC}"

# Verify tables
TABLES=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "\dt" | grep -c "public")

echo -e "Tables created: ${GREEN}$TABLES${NC}"

PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -c "\dt"

echo -e "\n${GREEN}=== Setup Complete! ===${NC}\n"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASS"
echo ""
echo "Connection string:"
echo "postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo -e "${YELLOW}Update your .env file with this connection string${NC}"
