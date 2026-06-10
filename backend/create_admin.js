// Script to create default admin user
// Usage: cd backend && node create_admin.js <email> <password> [role]
// Or:    ADMIN_EMAIL=... ADMIN_PASSWORD=... node create_admin.js

const db = require('./db');
const bcrypt = require('bcryptjs');

const DEFAULT_ROLE = 'superadmin';

async function createAdmin() {
  try {
    const email = process.argv[2] || process.env.ADMIN_EMAIL;
    const password = process.argv[3] || process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      console.error('Email and password required.');
      console.error('Usage: node create_admin.js <email> <password> [role]');
      console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.');
      process.exit(1);
    }
    const role = process.argv[4] || DEFAULT_ROLE;

    console.log(`Creating admin user...`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log('');

    // Check if admin already exists
    const checkResult = await db.query(
      'SELECT id, email, role FROM profiles WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      const existingUser = checkResult.rows[0];
      console.log(`⚠️  User with email ${email} already exists!`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log('');
      console.log('To update the password, delete the user first or use a different email.');
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✓ Password hashed');

    // Create admin user
    const result = await db.query(
      `INSERT INTO profiles (email, full_name, role, password_hash, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, email, full_name, role`,
      [
        email,
        'Admin User',
        role,
        passwordHash,
        '+91 00000 00000'
      ]
    );

    const admin = result.rows[0];
    console.log('');
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     ${admin.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createAdmin();

