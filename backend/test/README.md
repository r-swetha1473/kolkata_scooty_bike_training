# API Endpoint Test Runner

**⚠️ DEV-ONLY TOOL - DO NOT DEPLOY TO PRODUCTION**

This test runner programmatically tests all API endpoints to ensure:
- No endpoints crash with 500 errors
- All endpoints return structured error responses
- Proper authentication/authorization handling

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Ensure your database is running and accessible (tests will fail gracefully if DB is unavailable)

3. Set up environment variables (`.env` file):
```env
JWT_SECRET=your-secret-key
DATABASE_URL=your-database-url
# ... other required env vars
```

## Usage

Run the endpoint tests:
```bash
npm run test:endpoints
```

Or directly:
```bash
NODE_ENV=test node test/endpoints.test.js
```

## What It Tests

The test runner systematically tests all API endpoints:

- **Authentication Routes** (`/api/auth`)
- **Profile Routes** (`/api/profiles`)
- **Trainer Routes** (`/api/trainers`)
- **Slot Routes** (`/api/slots`)
- **Booking Routes** (`/api/bookings`)
- **Admin Routes** (`/api/admin`)
- **Admin Management Routes** (`/api/admin-management`)
- **Rating Routes** (`/api/ratings`)
- **Recognition Routes** (`/api/recognition`)
- **Settings Routes** (`/api/settings`)
- **Vehicle Routes** (`/api/vehicles`)

## Test Output

The test runner provides:
- ✅ **Passed tests** - Endpoints that respond correctly (non-500 status)
- ❌ **Failed tests** - Endpoints that return 500 errors or crash
- ⚠️ **Warnings** - Endpoints with non-structured error responses or unexpected status codes

Each failed test includes:
- Status code
- Error message
- Error code (if available)
- Stack trace (if available)

## Notes

- Tests use **mock JWT tokens** - they don't require actual user accounts
- Database queries may fail if DB is unavailable - this is expected and will be reported
- Some endpoints may return 401/403/404 errors - this is **expected behavior** and not considered a failure
- Only **500 errors** and **unhandled exceptions** are considered failures
- The test runner exits with code 1 if any tests fail, 0 if all pass

## Limitations

- Does not test actual business logic correctness
- Does not verify database data integrity
- Mock tokens may not work if middleware requires actual database lookups
- Rate limiting may affect test results if tests run too quickly

## Troubleshooting

**Issue: Tests fail with database connection errors**
- Ensure database is running and accessible
- Check DATABASE_URL in .env file
- Some tests may still pass even if DB is unavailable (endpoints that don't query DB)

**Issue: All auth tests return 401**
- This is expected if the database doesn't have matching user records
- The test checks that endpoints handle auth properly, not that auth succeeds

**Issue: Tests timeout**
- Check if server is running on expected port
- Ensure no firewall blocking connections
- Verify database connection is not slow
