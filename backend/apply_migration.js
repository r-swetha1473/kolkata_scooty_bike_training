// Backend migration script (uses backend's db.js)
// Usage: cd backend && node apply_migration.js

const db = require('./db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Usage:
//   node apply_migration.js [path/to/file.sql] [--skip-admin] [--with-admin]
// If you pass a .sql path, only that file runs (recommended for Neon / incremental updates).
// Admin bootstrap runs only for the legacy default migration, unless you pass --with-admin.
const defaultMigration = path.join(__dirname, '..', 'supabase', 'migrations', '20250105000000_kolkata_scooty_requirements.sql');
const fallbackMigration = path.join(__dirname, '..', 'supabase', 'migrations', '20250103000000_migrate_to_direct_postgresql.sql');
const argPath = process.argv[2] && !String(process.argv[2]).startsWith('--') ? process.argv[2] : null;
const migrationFile = argPath
  ? path.isAbsolute(argPath)
    ? argPath
    : path.join(process.cwd(), argPath)
  : fs.existsSync(defaultMigration)
    ? defaultMigration
    : fallbackMigration;
const skipAdmin =
  process.argv.includes('--skip-admin') ||
  (argPath != null && !process.argv.includes('--with-admin'));

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
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
      const msg0 = (error.message || '').split('\n')[0];
      if (
        msg0.includes('already exists') ||
        msg0.includes('does not exist') ||
        (msg0.includes('column') && msg0.includes('already'))
      ) {
        console.log(`  Note: ${msg0}`);
        console.log('✓ Migration skipped or partially already applied.');
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







