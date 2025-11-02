require('dotenv').config();
const db = require('./db');

async function checkAuthSetup() {
  console.log('Checking Authentication Setup...\n');
  console.log('═══════════════════════════════════════════\n');

  // Check JWT_SECRET
  console.log('1. Checking JWT_SECRET...');
  if (process.env.JWT_SECRET) {
    console.log('   ✅ JWT_SECRET is set');
    console.log(`   Length: ${process.env.JWT_SECRET.length} characters\n`);
  } else {
    console.log('   ❌ JWT_SECRET is NOT set in .env file');
    console.log('   Please add JWT_SECRET to your backend/.env file\n');
  }

  // Check database connection
  console.log('2. Checking database connection...');
  try {
    await db.query('SELECT NOW()');
    console.log('   ✅ Database connection successful\n');
  } catch (error) {
    console.log('   ❌ Database connection failed');
    console.log(`   Error: ${error.message}\n`);
    process.exit(1);
  }

  // Check admin users
  console.log('3. Checking admin users...');
  try {
    const result = await db.query(
      `SELECT email, full_name, role,
              CASE 
                WHEN password_hash IS NULL THEN 'No password'
                WHEN password_hash = '' THEN 'Empty password'
                ELSE 'Password set'
              END as password_status
       FROM profiles
       WHERE role IN ('admin', 'superadmin')
       ORDER BY role, email`
    );

    if (result.rows.length === 0) {
      console.log('   ⚠️  No admin users found in database');
      console.log('   Run: node fix_admin_passwords.js\n');
    } else {
      console.log(`   Found ${result.rows.length} admin user(s):\n`);
      result.rows.forEach((user, index) => {
        const status = user.password_status === 'Password set' ? '✅' : '❌';
        console.log(`   ${status} ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Name: ${user.full_name}`);
        console.log(`      Password: ${user.password_status}\n`);
      });
    }
  } catch (error) {
    console.log('   ❌ Error checking admin users');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('═══════════════════════════════════════════\n');
  console.log('Admin Login Credentials:');
  console.log('  Email:    admin@kolkatascotty.com');
  console.log('  Password: admin123\n');
  console.log('  Email:    superadmin@kolkatascotty.com');
  console.log('  Password: admin123\n');
  console.log('═══════════════════════════════════════════\n');

  process.exit(0);
}

checkAuthSetup();

