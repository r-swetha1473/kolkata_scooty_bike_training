const db = require('./db');
const bcrypt = require('bcryptjs');

async function fixAdminPasswords() {
  try {
    console.log('Fixing admin user passwords...\n');

    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    // Update admin user
    console.log('Updating admin@kolkatascotty.com...');
    const adminResult = await db.query(
      `UPDATE profiles
       SET password_hash = $1, updated_at = NOW()
       WHERE email = 'admin@kolkatascotty.com'
         AND (password_hash IS NULL OR password_hash = '')
         AND role IN ('admin', 'superadmin')
       RETURNING id, email, full_name, role`,
      [passwordHash]
    );

    if (adminResult.rows.length > 0) {
      console.log('✓ Admin user password updated');
      console.log(`  - ${adminResult.rows[0].email} (${adminResult.rows[0].role})`);
    } else {
      console.log('ℹ Admin user already has a password or not found');
    }

    // Update superadmin user
    console.log('\nUpdating superadmin@kolkatascotty.com...');
    const superadminResult = await db.query(
      `UPDATE profiles
       SET password_hash = $1, updated_at = NOW()
       WHERE email = 'superadmin@kolkatascotty.com'
         AND (password_hash IS NULL OR password_hash = '')
         AND role = 'superadmin'
       RETURNING id, email, full_name, role`,
      [passwordHash]
    );

    if (superadminResult.rows.length > 0) {
      console.log('✓ Superadmin user password updated');
      console.log(`  - ${superadminResult.rows[0].email} (${superadminResult.rows[0].role})`);
    } else {
      console.log('ℹ Superadmin user already has a password or not found');
    }

    // Verify all admin users
    console.log('\nVerifying admin users...');
    const verifyResult = await db.query(
      `SELECT email, full_name, role,
              CASE 
                WHEN password_hash IS NULL THEN 'No password'
                WHEN password_hash = '' THEN 'Empty password'
                ELSE 'Password set'
              END as password_status
       FROM profiles
       WHERE email IN ('admin@kolkatascotty.com', 'superadmin@kolkatascotty.com')
         AND role IN ('admin', 'superadmin')`
    );

    console.log('\n═══════════════════════════════════════════');
    console.log('Admin Users Status:');
    console.log('═══════════════════════════════════════════');
    verifyResult.rows.forEach(user => {
      const status = user.password_status === 'Password set' ? '✅' : '❌';
      console.log(`${status} ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.password_status}`);
      console.log('');
    });
    console.log('═══════════════════════════════════════════\n');

    console.log('Admin login credentials:');
    console.log('  Email:    admin@kolkatascotty.com');
    console.log('  Password: admin123\n');
    console.log('  Email:    superadmin@kolkatascotty.com');
    console.log('  Password: admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing admin passwords:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('connection')) {
      console.error('\n💡 Database connection error. Please check:');
      console.error('  1. PostgreSQL is running');
      console.error('  2. DATABASE_URL in .env file is correct');
    }
    
    process.exit(1);
  }
}

fixAdminPasswords();



