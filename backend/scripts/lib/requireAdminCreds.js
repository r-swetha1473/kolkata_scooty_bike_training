/**
 * Require ADMIN_EMAIL and ADMIN_PASSWORD from environment (no hardcoded defaults).
 */
function requireAdminCreds() {
  const email = process.env.ADMIN_EMAIL || process.env.TEST_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(
      'Missing credentials: set ADMIN_EMAIL and ADMIN_PASSWORD (or TEST_ADMIN_*) in backend/.env'
    );
    process.exit(1);
  }
  return { email, password };
}

module.exports = { requireAdminCreds };
