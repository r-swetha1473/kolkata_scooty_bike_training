/**
 * Verify required production migrations against connected DATABASE_URL.
 * Usage: node scripts/verify_migrations.js
 */
require('dotenv').config();
const db = require('../db');

const CHECKS = [
  {
    migration: '20260609120000_phase2_rbac_subadmin.sql',
    name: 'sub_admin_permissions table',
    sql: `SELECT to_regclass('public.sub_admin_permissions') AS ok`
  },
  {
    migration: '20260609120000_phase2_rbac_subadmin.sql',
    name: 'profiles.admin_is_active column',
    sql: `SELECT 1 AS ok FROM information_schema.columns
          WHERE table_schema='public' AND table_name='profiles' AND column_name='admin_is_active'`
  },
  {
    migration: '20260609120000_phase2_rbac_subadmin.sql',
    name: 'subadmin role in profiles constraint',
    sql: `SELECT 1 AS ok FROM pg_constraint
          WHERE conrelid='profiles'::regclass AND contype='c'
            AND pg_get_constraintdef(oid) LIKE '%subadmin%'`
  },
  {
    migration: '20260121000000_phase4_admin_audit_log.sql',
    name: 'admin_audit_log table',
    sql: `SELECT to_regclass('public.admin_audit_log') AS ok`
  },
  {
    migration: '20260609130000_admin_password_management.sql',
    name: 'profiles.must_change_password column',
    sql: `SELECT 1 AS ok FROM information_schema.columns
          WHERE table_schema='public' AND table_name='profiles' AND column_name='must_change_password'`
  },
  {
    migration: '20260609140000_auto_slot_capacity_setting.sql',
    name: 'auto_slot_capacity_from_vehicles setting',
    sql: `SELECT 1 AS ok FROM settings WHERE key='auto_slot_capacity_from_vehicles'`
  },
  {
    migration: '20260609150000_admin_notifications.sql',
    name: 'admin_notifications table',
    sql: `SELECT to_regclass('public.admin_notifications') AS ok`
  },
  {
    migration: '20260609150000_admin_notifications.sql',
    name: 'admin_notification_reads table',
    sql: `SELECT to_regclass('public.admin_notification_reads') AS ok`
  },
  {
    migration: '20260612120000_account_reactivation_requests.sql',
    name: 'account_reactivation_requests table',
    sql: `SELECT to_regclass('public.account_reactivation_requests') AS ok`
  },
  {
    migration: '20260612130000_bookings_trainer_id_nullable.sql',
    name: 'bookings.trainer_id nullable',
    sql: `SELECT 1 AS ok FROM information_schema.columns
          WHERE table_schema='public' AND table_name='bookings'
            AND column_name='trainer_id' AND is_nullable='YES'`
  }
];

async function main() {
  console.log('Migration Verification Report\n');
  let pass = 0;
  let fail = 0;

  for (const c of CHECKS) {
    try {
      const r = await db.query(c.sql);
      const ok = r.rows.length > 0 && (r.rows[0].ok === 1 || r.rows[0].ok);
      if (ok) {
        console.log(`PASS  [${c.migration}] ${c.name}`);
        pass++;
      } else {
        console.log(`FAIL  [${c.migration}] ${c.name}`);
        fail++;
      }
    } catch (e) {
      console.log(`FAIL  [${c.migration}] ${c.name} — ${e.message}`);
      fail++;
    }
  }

  const overdue = await db.query(
    `SELECT COUNT(*)::int AS c FROM bookings b
     JOIN slots s ON b.slot_id = s.id
     WHERE b.status IN ('pending','confirmed') AND s.end_time < NOW()`
  );
  console.log(`\nOverdue bookings (live): ${overdue.rows[0]?.c ?? '?'}`);

  const vehicles = await db.query(`SELECT COUNT(*)::int AS c FROM vehicles WHERE is_active=true`);
  console.log(`Active vehicles (slot capacity): ${vehicles.rows[0]?.c ?? '?'}`);

  const tables = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`
  );
  console.log(`\nExisting tables: ${tables.rows.map((r) => r.table_name).join(', ')}`);

  const roles = await db.query(`SELECT role, COUNT(*)::int AS c FROM profiles GROUP BY role ORDER BY c DESC`);
  console.log('Profile roles:', roles.rows.map((r) => `${r.role}=${r.c}`).join(', '));

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  await db.pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
