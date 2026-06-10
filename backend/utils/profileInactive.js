/**
 * Safe access to profiles.inactive_blocked (handles missing column before migration).
 */
const db = require('../db');

const MISSING_COLUMN_CODE = '42703';

async function query(client, sql, params) {
  if (client && typeof client.query === 'function') {
    return client.query(sql, params);
  }
  return db.query(sql, params);
}

function isMissingInactiveBlockedColumn(err) {
  const msg = String(err?.message || '');
  return err?.code === MISSING_COLUMN_CODE && msg.includes('inactive_blocked');
}

/**
 * @returns {{ role: string|null, inactive_blocked: boolean, schemaWarning?: string }}
 */
async function getProfileInactiveStatus(userId, client = null) {
  try {
    const result = await query(
      client,
      'SELECT role, inactive_blocked FROM profiles WHERE id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      return { role: null, inactive_blocked: false };
    }
    return {
      role: row.role,
      inactive_blocked: row.inactive_blocked === true
    };
  } catch (err) {
    if (!isMissingInactiveBlockedColumn(err)) {
      throw err;
    }
    console.error(
      '[Schema] profiles.inactive_blocked column missing. Apply migration 20260406000000_profile_inactive_blocked.sql'
    );
    const fallback = await query(client, 'SELECT role FROM profiles WHERE id = $1', [userId]);
    const row = fallback.rows[0];
    return {
      role: row?.role ?? null,
      inactive_blocked: false,
      schemaWarning: 'INACTIVE_BLOCKED_COLUMN_MISSING'
    };
  }
}

function isCustomerInactiveBlocked(profile) {
  return profile?.role === 'customer' && profile?.inactive_blocked === true;
}

module.exports = {
  getProfileInactiveStatus,
  isCustomerInactiveBlocked,
  isMissingInactiveBlockedColumn
};
