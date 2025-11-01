const db = require('./db');

async function insertAdmin() {
  try {
    console.log('Starting admin user insertion...\n');

    // Step 1: Add password_hash column if it doesn't exist
    console.log('Step 1: Checking password_hash column...');
    try {
      await db.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'profiles' AND column_name = 'password_hash'
            ) THEN
                ALTER TABLE profiles ADD COLUMN password_hash TEXT;
                RAISE NOTICE 'Added password_hash column';
            END IF;
        END $$;
      `);
      console.log('✓ password_hash column checked/added\n');
    } catch (error) {
      console.log('✓ Column check completed (may already exist)\n');
    }

    // Step 2: Insert or update admin user
    console.log('Step 2: Inserting/updating admin user...');
    await db.query(`
      INSERT INTO profiles (email, full_name, phone, role, password_hash)
      VALUES (
        'admin@kolkatascotty.com',
        'Admin User',
        '+91 98765 00001',
        'admin',
        '$2a$10$f87h02FkekIgyRPNLBlKEuf3KbUWrlfVrpqSJXdJYymnuTv749gVO'
      )
      ON CONFLICT (email) 
      DO UPDATE SET
        role = 'admin',
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = NOW();
    `);
    console.log('✓ Admin user inserted/updated\n');

    // Step 3: Verify insertion
    console.log('Step 3: Verifying admin user...');
    const result = await db.query(
      'SELECT id, email, full_name, role, created_at FROM profiles WHERE email = $1 AND role = $2',
      ['admin@kolkatascotty.com', 'admin']
    );

    if (result.rows.length > 0) {
      console.log('✓ Admin user verified!\n');
      console.log('═══════════════════════════════════════════');
      console.log('✅ ADMIN USER CREATED SUCCESSFULLY!');
      console.log('═══════════════════════════════════════════');
      console.log('\nAdmin Credentials:');
      console.log('  Email:    admin@kolkatascotty.com');
      console.log('  Password: admin123');
      console.log('  Role:     admin');
      console.log('\nAdmin Details:');
      console.log('  ID:       ' + result.rows[0].id);
      console.log('  Name:     ' + result.rows[0].full_name);
      console.log('  Created:  ' + result.rows[0].created_at);
      console.log('\n═══════════════════════════════════════════\n');
    } else {
      throw new Error('Admin user was not found after insertion');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error inserting admin user:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('connection')) {
      console.error('\n💡 Database connection error. Please check:');
      console.error('  1. PostgreSQL is running');
      console.error('  2. DATABASE_URL in .env file is correct');
      console.error('  3. Database exists and user has permissions');
      console.error('\nExample DATABASE_URL:');
      console.error('  postgresql://user:password@localhost:5432/database_name');
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 Missing .env file. Please create one with DATABASE_URL');
    } else {
      console.error('\nFull error:', error);
    }
    
    process.exit(1);
  }
}

insertAdmin();
