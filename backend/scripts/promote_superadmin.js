/**
 * Promote production admin account(s) to superadmin when none exist.
 * Usage: cd backend && node scripts/promote_superadmin.js
 */
require('dotenv').config();
const db = require('../db');

async function main() {
  const before = await db.query(
    `SELECT role, COUNT(*)::int AS c FROM profiles
     WHERE role IN ('admin', 'superadmin') GROUP BY role`
  );
  console.log('Before:', before.rows);

  const existing = await db.query(`SELECT COUNT(*)::int AS c FROM profiles WHERE role = 'superadmin'`);
  if (existing.rows[0].c > 0) {
    console.log('Superadmin already exists — no promotion needed.');
    await db.pool.end();
    return;
  }

  const result = await db.query(
    `UPDATE profiles
     SET role = 'superadmin', admin_is_active = true
     WHERE role = 'admin'
     RETURNING id, role`
  );
  console.log(`Promoted ${result.rowCount} admin account(s) to superadmin.`);

  const after = await db.query(
    `SELECT role, COUNT(*)::int AS c FROM profiles
     WHERE role IN ('admin', 'superadmin') GROUP BY role`
  );
  console.log('After:', after.rows);
  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
