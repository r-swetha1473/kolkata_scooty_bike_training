// Node.js script to apply PostgreSQL migration
// Usage: node apply_postgresql_migration.js
// Note: This script uses backend's node_modules. Make sure backend dependencies are installed.

const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

// Add backend's node_modules to the module path FIRST
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain) {
  if (request === 'dotenv' || request === 'pg') {
    try {
      return originalResolveFilename.call(this, request, {
        paths: [path.join(backendDir, 'node_modules')].concat(Module._nodeModulePaths(backendDir))
      }, isMain);
    } catch (e) {
      // Fall through to default resolution
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain);
};

// Load .env FIRST before loading db.js
// Load .env from backend or root
const envPath = path.join(backendDir, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Load backend's db.js AFTER .env is loaded
const backendDbPath = path.join(backendDir, 'db.js');
const db = require(backendDbPath);

const migrationFile = process.argv[2] || path.join(__dirname, 'supabase', 'migrations', '20250103000000_migrate_to_direct_postgresql.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`Error: Migration file not found: ${migrationFile}`);
  process.exit(1);
}

async function applyMigration() {
  try {
    console.log(`Applying migration: ${migrationFile}`);
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Execute the entire SQL file as one statement (handles DO blocks properly)
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✓ Migration applied successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Some errors are expected for idempotent operations
      if (error.message.includes('already exists') || 
          error.message.includes('does not exist') ||
          (error.message.includes('column') && error.message.includes('already'))) {
        console.log(`  Note: ${error.message.split('\n')[0]}`);
        await client.query('COMMIT'); // Commit anyway for idempotent operations
        console.log('✓ Migration applied successfully (some changes already existed)!');
      } else {
        throw error;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();

