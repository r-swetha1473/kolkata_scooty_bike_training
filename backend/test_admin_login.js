require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

async function testAdminLogin() {
  try {
    console.log('Testing Admin Login Credentials...\n');

    const email = 'admin@kolkatascotty.com';
    const password = 'admin123';

    // Get admin user
    const result = await db.query(
      'SELECT * FROM profiles WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log(`✅ User found: ${email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password hash exists: ${!!user.password_hash}\n`);

    if (!user.password_hash) {
      console.log('❌ User does not have a password_hash');
      process.exit(1);
    }

    // Test password
    console.log('Testing password match...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (isPasswordValid) {
      console.log('✅ Password matches!');
      console.log(`\nLogin should work with:`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}\n`);
    } else {
      console.log('❌ Password does NOT match!');
      console.log('\nThe password_hash in the database does not match "admin123"');
      console.log('Run: node fix_admin_passwords.js to reset the password\n');
      process.exit(1);
    }

    // Check role
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      console.log(`❌ User role is "${user.role}", but should be "admin" or "superadmin"`);
      process.exit(1);
    } else {
      console.log(`✅ User role is valid: ${user.role}`);
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.log('\n❌ JWT_SECRET is not set in environment variables');
      process.exit(1);
    } else {
      console.log(`✅ JWT_SECRET is configured`);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ All checks passed! Login should work.');
    console.log('═══════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error testing login:', error.message);
    process.exit(1);
  }
}

testAdminLogin();

