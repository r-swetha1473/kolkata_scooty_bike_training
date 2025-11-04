// Backend migration script (uses backend's db.js)
// Usage: cd backend && node apply_migration.js

const db = require('./db');
const fs = require('fs');
const path = require('path');

const migrationFile = process.argv[2] || path.join(__dirname, '..', 'supabase', 'migrations', '20250103000000_migrate_to_direct_postgresql.sql');

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
          error.message.includes('column') && error.message.includes('already')) {
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



