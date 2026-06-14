/**
 * Search existing customers for offline booking deduplication.
 */

const db = require('../db');
const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');

async function searchOfflineCustomers({ phone, name, limit = 10 }) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 25);
  const matches = [];
  const seen = new Set();

  const pushMatch = (row) => {
    const key = row.source === 'profile'
      ? `profile:${row.user_id}`
      : `offline:${row.offline_customer_name}:${row.phone || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push(row);
  };

  let normalizedPhone = null;
  if (phone && String(phone).trim()) {
    normalizedPhone = normalizeIndianMobileDigits(phone);
  }

  const nameTerm = name && String(name).trim() ? `%${String(name).trim()}%` : null;

  if (normalizedPhone && normalizedPhone.length >= 3) {
    const profileByPhone = await db.query(
      `SELECT id AS user_id, full_name, phone, email, role
       FROM profiles
       WHERE role = 'customer'
         AND right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
       LIMIT $2`,
      [normalizedPhone, safeLimit]
    );
    for (const row of profileByPhone.rows) {
      pushMatch({
        source: 'profile',
        user_id: row.user_id,
        customer_name: row.full_name,
        phone: row.phone,
        email: row.email,
        last_booking_at: null
      });
    }

    const offlineByPhone = await db.query(
      `SELECT DISTINCT ON (COALESCE(b.offline_customer_name, ''), COALESCE(b.phone, ''))
              b.offline_customer_name,
              b.phone,
              b.user_id,
              MAX(b.created_at) OVER (PARTITION BY COALESCE(b.offline_customer_name, ''), COALESCE(b.phone, '')) AS last_booking_at
       FROM bookings b
       WHERE b.booking_source = 'OFFLINE'
         AND b.phone IS NOT NULL
         AND right(regexp_replace(b.phone, '\\D', '', 'g'), 10) = $1
       ORDER BY COALESCE(b.offline_customer_name, ''), COALESCE(b.phone, ''), b.created_at DESC
       LIMIT $2`,
      [normalizedPhone, safeLimit]
    );
    for (const row of offlineByPhone.rows) {
      pushMatch({
        source: 'offline_history',
        user_id: row.user_id,
        customer_name: row.offline_customer_name,
        phone: row.phone,
        email: null,
        last_booking_at: row.last_booking_at
      });
    }
  }

  if (nameTerm) {
    const profileByName = await db.query(
      `SELECT id AS user_id, full_name, phone, email
       FROM profiles
       WHERE role = 'customer' AND full_name ILIKE $1
       ORDER BY full_name ASC
       LIMIT $2`,
      [nameTerm, safeLimit]
    );
    for (const row of profileByName.rows) {
      pushMatch({
        source: 'profile',
        user_id: row.user_id,
        customer_name: row.full_name,
        phone: row.phone,
        email: row.email,
        last_booking_at: null
      });
    }

    const offlineByName = await db.query(
      `SELECT DISTINCT ON (b.offline_customer_name, COALESCE(b.phone, ''))
              b.offline_customer_name,
              b.phone,
              b.user_id,
              b.created_at AS last_booking_at
       FROM bookings b
       WHERE b.booking_source = 'OFFLINE'
         AND b.offline_customer_name ILIKE $1
       ORDER BY b.offline_customer_name, COALESCE(b.phone, ''), b.created_at DESC
       LIMIT $2`,
      [nameTerm, safeLimit]
    );
    for (const row of offlineByName.rows) {
      pushMatch({
        source: 'offline_history',
        user_id: row.user_id,
        customer_name: row.offline_customer_name,
        phone: row.phone,
        email: null,
        last_booking_at: row.last_booking_at
      });
    }
  }

  return matches.slice(0, safeLimit);
}

module.exports = {
  searchOfflineCustomers
};
