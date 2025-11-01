#!/usr/bin/env python3
"""
PostgreSQL Database Setup Script for Kolkata Scotty Bike Training
This script automates the setup of PostgreSQL database, user, and schema
It is idempotent and can be run multiple times safely
"""

import subprocess
import sys
import os
from typing import Tuple, Optional

# Color codes for output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color

# Configuration
DB_NAME = "kolkata_scotty"
DB_USER = "scotty"
DB_PASSWORD = "scotty123"
SCHEMA_FILE = "backend/schema.sql"
POSTGRES_USER = "postgres"


def print_success(message: str):
    """Print success message in green"""
    print(f"{Colors.GREEN}✓ {message}{Colors.NC}")


def print_error(message: str):
    """Print error message in red"""
    print(f"{Colors.RED}✗ {message}{Colors.NC}")


def print_info(message: str):
    """Print info message in yellow"""
    print(f"{Colors.YELLOW}ℹ {message}{Colors.NC}")


def run_command(command: list, check: bool = True, capture_output: bool = False) -> Tuple[bool, Optional[str]]:
    """
    Run a shell command and return success status and output
    
    Args:
        command: List of command and arguments
        check: If True, exit on error (default: True)
        capture_output: If True, capture and return output (default: False)
    
    Returns:
        Tuple of (success: bool, output: Optional[str])
    """
    try:
        result = subprocess.run(
            command,
            check=check,
            capture_output=capture_output,
            text=True,
            stderr=subprocess.DEVNULL if not capture_output else subprocess.STDOUT
        )
        output = result.stdout.strip() if capture_output else None
        return True, output
    except subprocess.CalledProcessError as e:
        if capture_output:
            return False, e.stdout.strip() if e.stdout else None
        return False, None
    except FileNotFoundError:
        return False, None


def check_postgresql_installed() -> bool:
    """Check if PostgreSQL client (psql) is installed"""
    print_info("Step 1: Checking if PostgreSQL is installed...")
    success, _ = run_command(["psql", "--version"], check=False)
    if not success:
        print_error("PostgreSQL client (psql) is not installed.")
        print_info("Please install PostgreSQL using: sudo apt-get install postgresql postgresql-contrib")
        return False
    print_success("PostgreSQL client is installed")
    return True


def check_postgresql_running() -> bool:
    """Check if PostgreSQL service is running"""
    print_info("Step 2: Checking if PostgreSQL service is running...")
    # Try to check service status
    success, _ = run_command(["systemctl", "is-active", "--quiet", "postgresql"], check=False)
    if not success:
        print_info("PostgreSQL service may not be running. Attempting to start...")
        success, _ = run_command(["sudo", "systemctl", "start", "postgresql"], check=False)
        if not success:
            print_error("PostgreSQL service is not running and could not be started.")
            print_info("Please start PostgreSQL service manually: sudo systemctl start postgresql")
            return False
        print_success("PostgreSQL service started successfully")
    else:
        print_success("PostgreSQL service is running")
    return True


def verify_connection() -> bool:
    """Verify PostgreSQL connection as postgres user"""
    print_info("Step 3: Verifying PostgreSQL connection...")
    success, _ = run_command(["sudo", "-u", POSTGRES_USER, "psql", "-c", "\\q"], check=False)
    if not success:
        print_error(f"Cannot connect to PostgreSQL as {POSTGRES_USER} user.")
        print_info("Please ensure PostgreSQL is properly configured and accessible.")
        return False
    print_success("PostgreSQL connection verified")
    return True


def create_database() -> bool:
    """Create database if it doesn't exist"""
    print_info(f"Step 4: Creating database '{DB_NAME}' if it doesn't exist...")
    
    # Check if database exists
    success, output = run_command(
        ["sudo", "-u", POSTGRES_USER, "psql", "-lqt"],
        check=False,
        capture_output=True
    )
    
    if success and output:
        databases = [line.split('|')[0].strip() for line in output.split('\n') if '|' in line]
        if DB_NAME in databases:
            print_info(f"Database '{DB_NAME}' already exists, skipping creation")
            return True
    
    # Create database
    success, _ = run_command(
        ["sudo", "-u", POSTGRES_USER, "psql", "-c", f"CREATE DATABASE {DB_NAME};"],
        check=False
    )
    
    if success:
        print_success(f"Database '{DB_NAME}' created successfully")
        return True
    else:
        print_error(f"Failed to create database '{DB_NAME}'")
        return False


def create_user() -> bool:
    """Create user if it doesn't exist, or update password if exists"""
    print_info(f"Step 5: Creating user '{DB_USER}' if it doesn't exist...")
    
    # Check if user exists
    success, output = run_command(
        ["sudo", "-u", POSTGRES_USER, "psql", "-tAc", f"SELECT 1 FROM pg_roles WHERE rolname='{DB_USER}';"],
        check=False,
        capture_output=True
    )
    
    user_exists = success and output and output.strip() == "1"
    
    if user_exists:
        print_info(f"User '{DB_USER}' already exists, updating password...")
        success, _ = run_command(
            ["sudo", "-u", POSTGRES_USER, "psql", "-c", f"ALTER USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}';"],
            check=False
        )
        if success:
            print_success(f"Password for user '{DB_USER}' updated successfully")
            return True
        else:
            print_error(f"Failed to update password for user '{DB_USER}'")
            return False
    else:
        success, _ = run_command(
            ["sudo", "-u", POSTGRES_USER, "psql", "-c", f"CREATE USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}';"],
            check=False
        )
        if success:
            print_success(f"User '{DB_USER}' created successfully")
            return True
        else:
            print_error(f"Failed to create user '{DB_USER}'")
            return False


def grant_database_privileges() -> bool:
    """Grant privileges on database to user"""
    print_info(f"Step 6: Granting privileges on database '{DB_NAME}' to user '{DB_USER}'...")
    
    commands = [
        ["sudo", "-u", POSTGRES_USER, "psql", "-c", f"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};"],
        ["sudo", "-u", POSTGRES_USER, "psql", "-c", f"ALTER USER {DB_USER} CREATEDB;"]
    ]
    
    for cmd in commands:
        success, _ = run_command(cmd, check=False)
        if not success:
            print_error("Failed to grant database privileges")
            return False
    
    print_success("Database privileges granted successfully")
    return True


def grant_schema_privileges() -> bool:
    """Grant schema privileges in the target database"""
    print_info("Step 7: Granting schema privileges...")
    
    commands = [
        ["sudo", "-u", POSTGRES_USER, "psql", "-d", DB_NAME, "-c", f"GRANT ALL ON SCHEMA public TO {DB_USER};"],
        ["sudo", "-u", POSTGRES_USER, "psql", "-d", DB_NAME, "-c", 
         f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {DB_USER};"],
        ["sudo", "-u", POSTGRES_USER, "psql", "-d", DB_NAME, "-c",
         f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {DB_USER};"]
    ]
    
    for cmd in commands:
        success, _ = run_command(cmd, check=False)
        if not success:
            print_error("Failed to grant schema privileges")
            return False
    
    print_success("Schema privileges granted successfully")
    return True


def check_schema_file() -> bool:
    """Check if schema file exists"""
    print_info("Step 8: Checking if schema file exists...")
    if not os.path.exists(SCHEMA_FILE):
        print_error(f"Schema file '{SCHEMA_FILE}' not found!")
        return False
    print_success(f"Schema file found: {SCHEMA_FILE}")
    return True


def execute_schema() -> bool:
    """Execute schema file"""
    print_info("Step 9: Executing schema file...")
    
    # Try with postgres user first
    success, _ = run_command(
        ["sudo", "-u", POSTGRES_USER, "psql", "-d", DB_NAME, "-f", SCHEMA_FILE],
        check=False
    )
    
    if success:
        print_success("Schema file executed successfully")
        return True
    
    # Try with scotty user as fallback
    print_info(f"Attempting to execute with user '{DB_USER}' instead...")
    env = os.environ.copy()
    env['PGPASSWORD'] = DB_PASSWORD
    
    success, _ = run_command(
        ["psql", "-U", DB_USER, "-d", DB_NAME, "-f", SCHEMA_FILE],
        check=False,
        env=env
    )
    
    if success:
        print_success(f"Schema file executed successfully with user '{DB_USER}'")
        return True
    else:
        print_error(f"Failed to execute schema file with user '{DB_USER}'")
        print_info(f"You may need to run the schema manually:")
        print_info(f"  psql -U {DB_USER} -d {DB_NAME} -f {SCHEMA_FILE}")
        return False


def verify_setup() -> bool:
    """Verify database setup by counting tables"""
    print_info("Verifying database setup...")
    success, output = run_command(
        ["sudo", "-u", POSTGRES_USER, "psql", "-d", DB_NAME, "-tAc",
         "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"],
        check=False,
        capture_output=True
    )
    
    if success and output:
        try:
            table_count = int(output.strip())
            if table_count > 0:
                print_success("Database setup completed successfully!")
                print_success(f"Found {table_count} table(s) in the database")
                print()
                print_info(f"Database: {DB_NAME}")
                print_info(f"User: {DB_USER}")
                print_info(f"Password: {DB_PASSWORD}")
                print()
                print_success("You can now connect to the database using:")
                print_info(f"  psql -U {DB_USER} -d {DB_NAME}")
                return True
            else:
                print_error("Database setup completed but no tables were found")
                return False
        except ValueError:
            print_error("Could not verify table count")
            return False
    else:
        print_error("Could not verify database setup")
        return False


def main():
    """Main function to orchestrate database setup"""
    print("=" * 60)
    print("PostgreSQL Database Setup for Kolkata Scotty Bike Training")
    print("=" * 60)
    print()
    
    steps = [
        check_postgresql_installed,
        check_postgresql_running,
        verify_connection,
        create_database,
        create_user,
        grant_database_privileges,
        grant_schema_privileges,
        check_schema_file,
        execute_schema,
        verify_setup
    ]
    
    for step in steps:
        if not step():
            print_error("Setup failed. Please check the errors above.")
            sys.exit(1)
    
    print()
    print("=" * 60)
    print("Setup completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()

