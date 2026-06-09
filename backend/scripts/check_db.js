const db = require('../db');

async function main() {
  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  const checks = await db.query(
    `SELECT
       to_regclass('public.profiles') AS profiles,
       to_regclass('public.bookings') AS bookings,
       to_regclass('public.admin_audit_log') AS admin_audit_log,
       to_regclass('public.sub_admin_permissions') AS sub_admin_permissions`
  );
  console.log('KEY TABLES:', JSON.stringify(checks.rows[0], null, 2));
  console.log('ALL TABLES:', tables.rows.map((r) => r.table_name).join(', ') || '(none)');
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
