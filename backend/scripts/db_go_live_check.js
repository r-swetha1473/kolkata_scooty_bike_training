/**
 * Go-live database validation (no PII output).
 * Usage: cd backend && node scripts/db_go_live_check.js
 */
require('dotenv').config();
const db = require('../db');

async function main() {
  const schema = await db.query(`
    SELECT
      to_regclass('public.admin_audit_log') IS NOT NULL AS audit_log,
      to_regclass('public.sub_admin_permissions') IS NOT NULL AS rbac,
      to_regclass('public.admin_notifications') IS NOT NULL AS notifications,
      to_regclass('public.admin_notification_reads') IS NOT NULL AS notification_reads,
      EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='profiles' AND column_name='admin_is_active') AS admin_is_active,
      EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name='profiles' AND column_name='must_change_password') AS must_change_password,
      EXISTS (SELECT 1 FROM settings WHERE key='auto_slot_capacity_from_vehicles') AS slot_capacity_setting,
      EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid='profiles'::regclass AND pg_get_constraintdef(oid) LIKE '%subadmin%') AS subadmin_role
  `);
  console.log('Schema checks:', schema.rows[0]);

  const roles = await db.query(`
    SELECT role, COUNT(*)::int AS count FROM profiles
    WHERE role IN ('admin', 'superadmin', 'subadmin')
    GROUP BY role ORDER BY role
  `);
  console.log('Admin roles:', roles.rows);

  const overdue = await db.query(`
    SELECT COUNT(*)::int AS count FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('pending', 'confirmed') AND s.end_time < NOW()
  `);
  console.log('Overdue bookings:', overdue.rows[0].count);

  const notifs = await db.query(`SELECT COUNT(*)::int AS count FROM admin_notifications`);
  console.log('Notification rows:', notifs.rows[0].count);

  const audit = await db.query(`SELECT COUNT(*)::int AS count FROM admin_audit_log`);
  console.log('Audit log rows:', audit.rows[0].count);

  const setting = await db.query(
    `SELECT value FROM settings WHERE key = 'auto_slot_capacity_from_vehicles'`
  );
  console.log('Auto slot capacity setting:', setting.rows[0]?.value ?? 'missing');

  const vehicles = await db.query(`SELECT COUNT(*)::int AS count FROM vehicles WHERE is_active = true`);
  console.log('Active vehicles:', vehicles.rows[0].count);

  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
