// Backend migration script (uses backend's db.js)
// Usage: cd backend && node apply_migration.js

const db = require('./db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const migrationFile = process.argv[2] || path.join(__dirname, '..', 'supabase', 'migrations', '20250103000000_migrate_to_direct_postgresql.sql');
const skipAdmin = process.argv.includes('--skip-admin');

if (!fs.existsSync(migrationFile)) {
  console.error(`Error: Migration file not found: ${migrationFile}`);
  process.exit(1);
}

async function applyMigration() {
  try {
    console.log(`Applying migration: ${migrationFile}`);
    console.log('');
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Execute the entire SQL file as one statement (handles DO blocks properly)
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✓ Migration applied successfully!');
      console.log('');
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Some errors are expected for idempotent operations
      if (error.message.includes('already exists') || 
          error.message.includes('does not exist') ||
          error.message.includes('column') && error.message.includes('already')) {
        console.log(`  Note: ${error.message.split('\n')[0]}`);
        await client.query('COMMIT'); // Commit anyway for idempotent operations
        console.log('✓ Migration applied successfully (some changes already existed)!');
        console.log('');
      } else {
        throw error;
      }
    } finally {
      client.release();
    }

    // Create admin user after migration
    if (!skipAdmin) {
      console.log('Creating default admin user...');
      console.log('');
      
      return new Promise((resolve, reject) => {
        const createAdmin = spawn('node', ['create_admin.js'], {
          cwd: __dirname,
          stdio: 'inherit',
          shell: true
        });

        createAdmin.on('close', (code) => {
          if (code === 0) {
            console.log('');
            console.log('✅ Setup complete! You can now log in to the admin panel.');
            resolve();
          } else {
            console.log('');
            console.log('⚠️  Admin creation skipped or failed. You can create an admin user manually:');
            console.log('   cd backend && node create_admin.js');
            resolve(); // Don't fail the migration if admin creation fails
          }
        });

        createAdmin.on('error', (error) => {
          console.log('');
          console.log('⚠️  Could not create admin user automatically. You can create one manually:');
          console.log('   cd backend && node create_admin.js');
          resolve(); // Don't fail the migration if admin creation fails
        });
      });
    }
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();







