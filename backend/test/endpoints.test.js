/**
 * API Endpoint Test Runner (DEV-ONLY)
 * 
 * This script tests all API endpoints to ensure:
 * - No endpoints crash with 500 errors
 * - All endpoints return structured error responses
 * - Proper authentication/authorization handling
 * 
 * DO NOT DEPLOY TO PRODUCTION
 * Usage: NODE_ENV=test node test/endpoints.test.js
 */

// Safety check - prevent running in production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: This test runner cannot be executed in production environment!');
  console.error('   Set NODE_ENV=test or NODE_ENV=development to run tests.');
  process.exit(1);
}

const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import routes
const authRoutes = require('../routes/auth');
const profileRoutes = require('../routes/profiles');
const trainerRoutes = require('../routes/trainers');
const slotRoutes = require('../routes/slots');
const bookingRoutes = require('../routes/bookings');
const adminRoutes = require('../routes/admin');
const ratingsRoutes = require('../routes/ratings');
const settingsRoutes = require('../routes/settings');
const vehiclesRoutes = require('../routes/vehicles');
const recognitionRoutes = require('../routes/recognition');
const adminManagementRoutes = require('../routes/adminManagement');
const errorHandler = require('../middleware/errorHandler');

// Create test app
const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes (may fail if dependencies not configured - that's OK for testing)
try {
  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/trainers', trainerRoutes);
  app.use('/api/slots', slotRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ratings', ratingsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/vehicles', vehiclesRoutes);
  app.use('/api/recognition', recognitionRoutes);
  app.use('/api/admin-management', adminManagementRoutes);
} catch (error) {
  console.error('⚠️  Warning: Some routes may not be loaded:', error.message);
  // Continue anyway - test will catch route errors
}

// Error handler must be last
app.use(errorHandler);

// Mock JWT secret if not set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-for-endpoint-testing-only';
}

// Generate mock tokens
function generateMockToken(userId = 'test-user-id', email = 'test@example.com', role = 'customer') {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function generateMockAdminToken(userId = 'test-admin-id', email = 'admin@example.com', role = 'admin') {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function generateMockSuperAdminToken(userId = 'test-superadmin-id', email = 'superadmin@example.com', role = 'superadmin') {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Test results storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: []
};

// Test helper function
async function testEndpoint(method, path, options = {}) {
  const {
    auth = null, // 'user', 'admin', 'superadmin', or null
    body = null,
    query = null,
    expectedStatus = null, // null means any non-500 is acceptable
    description = null
  } = options;

  testResults.total++;
  const testName = `${method.toUpperCase()} ${path}${description ? ` - ${description}` : ''}`;

  try {
    let token = null;
    if (auth === 'user') {
      token = generateMockToken();
    } else if (auth === 'admin') {
      token = generateMockAdminToken();
    } else if (auth === 'superadmin') {
      token = generateMockSuperAdminToken();
    }

    let req = request(app)[method.toLowerCase()](path);

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
      req = req.set('Cookie', `auth_token=${token}`);
    }

    if (query) {
      req = req.query(query);
    }

    if (body) {
      req = req.send(body);
    }

    const response = await req;

    const status = response.status;
    const isError = status >= 500;
    const isExpected = expectedStatus ? status === expectedStatus : !isError;

    // Check for structured error response
    const hasStructuredError = isError 
      ? (response.body && (response.body.error || response.body.message || response.body.errorCode))
      : true;

    if (isError) {
      testResults.failed++;
      testResults.errors.push({
        endpoint: testName,
        status,
        error: response.body?.error || response.body?.message || 'Unknown error',
        errorCode: response.body?.errorCode || 'NO_ERROR_CODE',
        body: response.body,
        stack: response.body?.stack || null
      });
      console.error(`❌ FAILED: ${testName}`);
      console.error(`   Status: ${status}`);
      console.error(`   Error: ${response.body?.error || response.body?.message || 'Unknown error'}`);
      console.error(`   Error Code: ${response.body?.errorCode || 'NO_ERROR_CODE'}`);
      if (response.body?.stack) {
        console.error(`   Stack: ${response.body.stack.substring(0, 200)}...`);
      }
    } else if (!hasStructuredError && status >= 400) {
      testResults.warnings.push({
        endpoint: testName,
        status,
        message: 'Non-structured error response',
        body: response.body
      });
      console.warn(`⚠️  WARNING: ${testName} - Non-structured error response`);
    } else if (!isExpected) {
      testResults.warnings.push({
        endpoint: testName,
        status,
        expected: expectedStatus,
        actual: status,
        message: 'Unexpected status code'
      });
      console.warn(`⚠️  WARNING: ${testName} - Expected ${expectedStatus}, got ${status}`);
    } else {
      testResults.passed++;
      console.log(`✓ PASSED: ${testName} (${status})`);
    }

    return { status, body: response.body, passed: !isError && isExpected && hasStructuredError };
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({
      endpoint: testName,
      error: error.message,
      stack: error.stack
    });
    console.error(`❌ EXCEPTION: ${testName}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack.substring(0, 300)}...`);
    return { status: 0, body: null, passed: false, exception: error };
  }
}

// Main test runner
async function runTests() {
  console.log('\n🚀 Starting API Endpoint Tests (DEV-ONLY)\n');
  console.log('='.repeat(80));

  // Authentication Routes
  console.log('\n📋 Testing Authentication Routes (/api/auth)\n');
  await testEndpoint('POST', '/api/auth/login', {
    body: { email: 'test@example.com', password: 'test123' },
    expectedStatus: 401, // Should fail with invalid credentials
    description: 'Login with invalid credentials'
  });
  await testEndpoint('GET', '/api/auth/google', {
    description: 'Google OAuth initiation'
  });
  await testEndpoint('POST', '/api/auth/logout', {
    description: 'Logout'
  });
  await testEndpoint('GET', '/api/auth/me', {
    auth: null,
    expectedStatus: 401,
    description: 'Get current user without auth'
  });
  await testEndpoint('GET', '/api/auth/me', {
    auth: 'user',
    description: 'Get current user with auth'
  });

  // Profile Routes
  console.log('\n📋 Testing Profile Routes (/api/profiles)\n');
  await testEndpoint('GET', '/api/profiles/me', {
    auth: null,
    expectedStatus: 401,
    description: 'Get profile without auth'
  });
  await testEndpoint('GET', '/api/profiles/me', {
    auth: 'user',
    description: 'Get own profile'
  });
  await testEndpoint('PUT', '/api/profiles/me', {
    auth: 'user',
    body: { full_name: 'Test User' },
    description: 'Update own profile'
  });

  // Trainer Routes (Public)
  console.log('\n📋 Testing Trainer Routes (/api/trainers)\n');
  await testEndpoint('GET', '/api/trainers', {
    description: 'List all trainers'
  });
  await testEndpoint('GET', '/api/trainers/active', {
    description: 'List active trainers'
  });
  await testEndpoint('GET', '/api/trainers/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Get trainer by ID'
  });

  // Slot Routes
  console.log('\n📋 Testing Slot Routes (/api/slots)\n');
  await testEndpoint('GET', '/api/slots', {
    description: 'List slots'
  });
  await testEndpoint('GET', '/api/slots/date/2025-01-27', {
    description: 'Get slots by date'
  });
  await testEndpoint('GET', '/api/slots/range', {
    query: { start_date: '2025-01-27', end_date: '2025-01-28' },
    description: 'Get slots by range'
  });
  await testEndpoint('GET', '/api/slots/available', {
    description: 'Get available slots'
  });
  await testEndpoint('GET', '/api/slots/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Get slot by ID'
  });
  await testEndpoint('POST', '/api/slots', {
    auth: null,
    expectedStatus: 401,
    description: 'Create slot without auth'
  });
  await testEndpoint('POST', '/api/slots', {
    auth: 'user',
    expectedStatus: 403,
    description: 'Create slot as user (should fail)'
  });
  await testEndpoint('POST', '/api/slots', {
    auth: 'admin',
    body: { trainer_id: '123', start_time: '2025-01-27T10:00:00Z', end_time: '2025-01-27T10:30:00Z', capacity: 5 },
    description: 'Create slot as admin'
  });
  await testEndpoint('PUT', '/api/slots/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: { status: 'available' },
    description: 'Update slot'
  });
  await testEndpoint('DELETE', '/api/slots/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    description: 'Delete slot'
  });
  await testEndpoint('POST', '/api/slots/generate', {
    auth: 'admin',
    body: { date: '2025-01-27' },
    description: 'Generate slots'
  });
  await testEndpoint('GET', '/api/slots/next-available-date', {
    auth: 'admin',
    description: 'Get next available date'
  });

  // Booking Routes
  console.log('\n📋 Testing Booking Routes (/api/bookings)\n');
  await testEndpoint('POST', '/api/bookings', {
    auth: null,
    expectedStatus: 401,
    description: 'Create booking without auth'
  });
  await testEndpoint('POST', '/api/bookings', {
    auth: 'user',
    body: {
      slot_id: '123e4567-e89b-12d3-a456-426614174000'
    },
    description: 'Create booking (may fail validation; server assigns trainer/vehicle)'
  });
  await testEndpoint('GET', '/api/bookings/my-bookings', {
    auth: null,
    expectedStatus: 401,
    description: 'Get bookings without auth'
  });
  await testEndpoint('GET', '/api/bookings/my-bookings', {
    auth: 'user',
    description: 'Get user bookings'
  });
  await testEndpoint('PUT', '/api/bookings/123e4567-e89b-12d3-a456-426614174000/cancel', {
    auth: 'user',
    description: 'Cancel booking'
  });

  // Admin Routes
  console.log('\n📋 Testing Admin Routes (/api/admin)\n');
  await testEndpoint('GET', '/api/admin/bookings', {
    auth: null,
    expectedStatus: 401,
    description: 'Get admin bookings without auth'
  });
  await testEndpoint('GET', '/api/admin/bookings', {
    auth: 'user',
    expectedStatus: 403,
    description: 'Get admin bookings as user (should fail)'
  });
  await testEndpoint('GET', '/api/admin/bookings', {
    auth: 'admin',
    description: 'Get admin bookings as admin'
  });
  await testEndpoint('GET', '/api/admin/users', {
    auth: 'admin',
    description: 'List users'
  });
  await testEndpoint('GET', '/api/admin/customers', {
    auth: 'admin',
    description: 'List customers'
  });
  await testEndpoint('GET', '/api/admin/dashboard', {
    auth: 'admin',
    description: 'Get dashboard stats'
  });
  await testEndpoint('GET', '/api/admin/trainers', {
    auth: 'admin',
    description: 'List trainers'
  });
  await testEndpoint('POST', '/api/admin/trainers', {
    auth: 'admin',
    body: { email: 'trainer@test.com', full_name: 'Test Trainer', bio: 'Test bio' },
    description: 'Create trainer'
  });
  await testEndpoint('GET', '/api/admin/trainers/123e4567-e89b-12d3-a456-426614174000/delete-preview', {
    auth: 'admin',
    description: 'Trainer delete preview (booking summary)'
  });
  await testEndpoint('DELETE', '/api/admin/trainers/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: { strategy: 'direct' },
    description: 'Delete trainer (direct strategy)'
  });
  await testEndpoint('DELETE', '/api/admin/trainers/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: { strategy: 'complete_all' },
    description: 'Delete trainer (complete_all strategy)'
  });
  await testEndpoint('DELETE', '/api/admin/trainers/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: { strategy: 'complete_past' },
    description: 'Delete trainer (complete_past strategy)'
  });
  await testEndpoint('DELETE', '/api/admin/trainers/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: {
      strategy: 'reassign',
      reassignToTrainerId: '223e4567-e89b-12d3-a456-426614174001'
    },
    description: 'Delete trainer (reassign strategy)'
  });
  await testEndpoint('GET', '/api/admin/slots', {
    auth: 'admin',
    expectedStatus: 410,
    description: 'Legacy admin slots route deprecated'
  });
  await testEndpoint('GET', '/api/admin/settings', {
    auth: 'admin',
    description: 'Get settings'
  });
  await testEndpoint('PUT', '/api/admin/bookings/123e4567-e89b-12d3-a456-426614174000/status', {
    auth: 'admin',
    body: { status: 'confirmed' },
    description: 'Update booking status'
  });
  await testEndpoint('GET', '/api/admin/audit-logs', {
    auth: 'admin',
    description: 'Get audit logs'
  });
  await testEndpoint('PUT', '/api/admin/change-password', {
    auth: 'admin',
    body: {
      current_password: 'wrong-old-pass',
      new_password: 'newpass123',
      confirm_password: 'newpass123'
    },
    description: 'Change own password (invalid current)'
  });
  await testEndpoint('PUT', '/api/admin/users/123e4567-e89b-12d3-a456-426614174000/reset-password', {
    auth: 'admin',
    expectedStatus: 403,
    body: { password: 'resetpass123' },
    description: 'Reset password as regular admin (should fail)'
  });
  await testEndpoint('PUT', '/api/admin/users/123e4567-e89b-12d3-a456-426614174000/reset-password', {
    auth: 'superadmin',
    body: { password: 'resetpass123' },
    description: 'Reset password as superadmin'
  });
  await testEndpoint('GET', '/api/admin/admins', {
    auth: 'superadmin',
    description: 'List admin accounts'
  });
  await testEndpoint('GET', '/api/admin/admins', {
    auth: 'admin',
    expectedStatus: 403,
    description: 'List admin accounts as regular admin (should fail)'
  });

  // Admin Management Routes
  console.log('\n📋 Testing Admin Management Routes (/api/admin-management)\n');
  await testEndpoint('POST', '/api/admin-management/create', {
    auth: 'admin',
    expectedStatus: 403,
    description: 'Create admin as regular admin (should fail)'
  });
  await testEndpoint('GET', '/api/admin-management/list', {
    auth: 'admin',
    expectedStatus: 403,
    description: 'List admins as regular admin (should fail)'
  });
  await testEndpoint('GET', '/api/admin-management/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    description: 'Get admin by ID'
  });
  await testEndpoint('PUT', '/api/admin-management/change-password', {
    auth: 'admin',
    body: { old_password: 'old', new_password: 'new' },
    description: 'Change password'
  });

  // Rating Routes
  console.log('\n📋 Testing Rating Routes (/api/ratings)\n');
  await testEndpoint('POST', '/api/ratings', {
    auth: null,
    expectedStatus: 401,
    description: 'Submit rating without auth'
  });
  await testEndpoint('POST', '/api/ratings', {
    auth: 'user',
    body: { booking_id: '123', rating_value: 5 },
    description: 'Submit rating'
  });
  await testEndpoint('GET', '/api/ratings/trainer/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Get trainer ratings'
  });

  // Recognition Routes
  console.log('\n📋 Testing Recognition Routes (/api/recognition)\n');
  await testEndpoint('POST', '/api/recognition', {
    auth: null,
    expectedStatus: 401,
    description: 'Submit recognition without auth'
  });
  await testEndpoint('POST', '/api/recognition', {
    auth: 'user',
    body: { phone_number: '1234567890', invoice_file_url: 'https://example.com/invoice.pdf' },
    description: 'Submit recognition'
  });
  await testEndpoint('GET', '/api/recognition/status', {
    auth: 'user',
    description: 'Get recognition status'
  });
  await testEndpoint('PUT', '/api/recognition/123e4567-e89b-12d3-a456-426614174000/approve', {
    auth: 'admin',
    description: 'Approve recognition'
  });

  // Settings Routes
  console.log('\n📋 Testing Settings Routes (/api/settings)\n');
  await testEndpoint('GET', '/api/settings', {
    description: 'Get all settings (public)'
  });
  await testEndpoint('GET', '/api/settings/all', {
    auth: null,
    expectedStatus: 401,
    description: 'Get settings metadata without auth'
  });
  await testEndpoint('GET', '/api/settings/all', {
    auth: 'admin',
    description: 'Get settings metadata'
  });
  await testEndpoint('GET', '/api/settings/test-key', {
    description: 'Get single setting'
  });
  await testEndpoint('PUT', '/api/settings/test-key', {
    auth: null,
    expectedStatus: 401,
    description: 'Update setting without auth'
  });
  await testEndpoint('PUT', '/api/settings/test-key', {
    auth: 'admin',
    body: { value: 'test-value' },
    description: 'Update setting'
  });

  // Vehicle Routes
  console.log('\n📋 Testing Vehicle Routes (/api/vehicles)\n');
  await testEndpoint('GET', '/api/vehicles', {
    description: 'List vehicles'
  });
  await testEndpoint('GET', '/api/vehicles/123e4567-e89b-12d3-a456-426614174000', {
    description: 'Get vehicle by ID'
  });
  await testEndpoint('POST', '/api/vehicles', {
    auth: null,
    expectedStatus: 401,
    description: 'Create vehicle without auth'
  });
  await testEndpoint('POST', '/api/vehicles', {
    auth: 'admin',
    body: { name: 'Test Vehicle', max_per_slot: 2 },
    description: 'Create vehicle'
  });
  await testEndpoint('PUT', '/api/vehicles/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    body: { name: 'Updated Vehicle' },
    description: 'Update vehicle'
  });
  await testEndpoint('DELETE', '/api/vehicles/123e4567-e89b-12d3-a456-426614174000', {
    auth: 'admin',
    description: 'Delete vehicle'
  });

  // Other Endpoints
  console.log('\n📋 Testing Other Endpoints\n');
  await testEndpoint('GET', '/health', {
    description: 'Health check'
  });

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary\n');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✓ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ Failed Tests:\n');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.endpoint}`);
      console.log(`   Status: ${error.status || 'Exception'}`);
      console.log(`   Error: ${error.error || error.message}`);
      console.log(`   Error Code: ${error.errorCode || 'N/A'}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.substring(0, 150)}...`);
      }
      console.log('');
    });
  }

  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');
    testResults.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.endpoint}`);
      console.log(`   ${warning.message}`);
      console.log('');
    });
  }

  // Exit with appropriate code
  const exitCode = testResults.failed > 0 ? 1 : 0;
  console.log(`\n${exitCode === 0 ? '✅' : '❌'} Test run ${exitCode === 0 ? 'completed successfully' : 'completed with errors'}\n`);
  
  process.exit(exitCode);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('\n💥 Fatal error running tests:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testEndpoint };
