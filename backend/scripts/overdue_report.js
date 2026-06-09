/**
 * Overdue booking summary (no PII).
 * Usage: cd backend && node scripts/overdue_report.js
 */
require('dotenv').config();
const overdueBooking = require('../services/overdueBooking.service');
const db = require('../db');

async function main() {
  const count = await overdueBooking.countOverdueBookings();
  const list = await overdueBooking.listOverdueBookings({ limit: 10 });

  const byStatus = await db.query(`
    SELECT b.status, COUNT(*)::int AS count
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('pending', 'confirmed') AND s.end_time < NOW()
    GROUP BY b.status ORDER BY count DESC
  `);

  console.log('Overdue total:', count);
  console.log('By status:', byStatus.rows);
  console.log('Sample count returned:', list.bookings?.length ?? list.length ?? 0);
  console.log('List total field:', list.total ?? 'n/a');

  await db.pool.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await db.pool.end(); } catch {}
  process.exit(1);
});
