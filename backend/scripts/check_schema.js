const db = require('../db');

async function main() {
  const cols = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
     ORDER BY column_name`
  );
  const roleCheck = await db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'profiles'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%role%'`
  );
  console.log('profiles columns:', cols.rows.map((r) => r.column_name).join(', '));
  console.log('role constraint:', roleCheck.rows[0]?.def || '(none)');
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
