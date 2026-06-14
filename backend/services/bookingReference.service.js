/**
 * Generates unique offline booking reference numbers: OFF-000001
 */

const db = require('../db');

async function generateOfflineReferenceNumber(client = null) {
  const runner = client || db;
  try {
    const result = await runner.query('SELECT generate_offline_reference_number() AS ref');
    return result.rows[0]?.ref || null;
  } catch (error) {
    if (
      error.message?.includes('generate_offline_reference_number') ||
      error.message?.includes('offline_booking_reference_seq')
    ) {
      const fallback = await runner.query(
        `SELECT 'OFF-' || LPAD(
          (COALESCE(
            (SELECT MAX(CAST(SUBSTRING(offline_reference_number FROM 5) AS INTEGER)) FROM bookings WHERE offline_reference_number IS NOT NULL),
            0
          ) + 1)::TEXT,
          6, '0'
        ) AS ref`
      );
      return fallback.rows[0]?.ref;
    }
    throw error;
  }
}

module.exports = {
  generateOfflineReferenceNumber
};
