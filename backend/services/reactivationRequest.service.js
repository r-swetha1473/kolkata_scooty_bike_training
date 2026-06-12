/**
 * Account reactivation request workflow (inactive_blocked customers).
 */

const db = require('../db');
const notificationService = require('./notification.service');
const { getProfileInactiveStatus } = require('../utils/profileInactive');

const ENSURE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS account_reactivation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  user_message TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactivation_one_pending_per_user
  ON account_reactivation_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reactivation_requests_status_requested
  ON account_reactivation_requests (status, requested_at DESC);
`;

async function tableExists() {
  const r = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'account_reactivation_requests'
     ) AS exists`
  );
  return !!r.rows[0]?.exists;
}

async function ensureSchemaOnStartup() {
  try {
    if (await tableExists()) {
      return { ok: true, created: false };
    }
    await db.query(ENSURE_SCHEMA_SQL);
    console.log('[Reactivation schema] account_reactivation_requests table ensured');
    return { ok: true, created: true };
  } catch (error) {
    console.error('[Reactivation schema]', error.message);
    return { ok: false, error: error.message };
  }
}

async function requireTable() {
  if (await tableExists()) {
    return;
  }
  await ensureSchemaOnStartup();
  if (!(await tableExists())) {
    const err = new Error('Reactivation requests are not available yet. Please contact admin.');
    err.status = 503;
    err.errorCode = 'SCHEMA_NOT_READY';
    throw err;
  }
}

async function getLatestForUser(userId) {
  if (!(await tableExists())) {
    return null;
  }
  const result = await db.query(
    `SELECT id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_notes, user_message
     FROM account_reactivation_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function createRequest(user) {
  await requireTable();

  const profile = await getProfileInactiveStatus(user.id);
  if (profile.role !== 'customer' || !profile.inactive_blocked) {
    const err = new Error('Your account is not inactive.');
    err.status = 400;
    err.errorCode = 'NOT_INACTIVE';
    throw err;
  }

  const pending = await db.query(
    `SELECT id FROM account_reactivation_requests
     WHERE user_id = $1 AND status = 'pending'
     LIMIT 1`,
    [user.id]
  );
  if (pending.rows.length > 0) {
    const err = new Error('You already have a pending reactivation request.');
    err.status = 409;
    err.errorCode = 'PENDING_REQUEST_EXISTS';
    throw err;
  }

  const insert = await db.query(
    `INSERT INTO account_reactivation_requests (user_id, status, requested_at)
     VALUES ($1, 'pending', NOW())
     RETURNING *`,
    [user.id]
  );
  const request = insert.rows[0];
  const displayName = user.full_name || 'A customer';

  await notificationService.createNotification({
    type: 'account_reactivation_request',
    title: 'Account reactivation request',
    body: `${displayName} has requested account reactivation.`,
    entity_type: 'user',
    entity_id: user.id,
    dedupeHours: 0
  }).catch(() => {});

  return request;
}

async function listForAdmin({ status = '', limit = 50, offset = 0 } = {}) {
  await requireTable().catch(() => {});
  if (!(await tableExists())) {
    return { requests: [], total: 0 };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);
  const params = [];
  let where = 'WHERE 1=1';

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM account_reactivation_requests r
     ${where}`,
    params
  );

  params.push(safeLimit, safeOffset);
  const listResult = await db.query(
    `SELECT r.*,
            p.full_name AS user_name,
            p.email AS user_email,
            p.phone AS user_phone,
            reviewer.full_name AS reviewed_by_name
     FROM account_reactivation_requests r
     JOIN profiles p ON p.id = r.user_id
     LEFT JOIN profiles reviewer ON reviewer.id = r.reviewed_by
     ${where}
     ORDER BY r.requested_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    requests: listResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    limit: safeLimit,
    offset: safeOffset
  };
}

async function approveRequest(requestId, adminId) {
  await requireTable();

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query(
      `SELECT r.*, p.full_name, p.email, p.inactive_blocked
       FROM account_reactivation_requests r
       JOIN profiles p ON p.id = r.user_id
       WHERE r.id = $1
       FOR UPDATE`,
      [requestId]
    );
    if (reqResult.rows.length === 0) {
      const err = new Error('Reactivation request not found');
      err.status = 404;
      throw err;
    }
    const row = reqResult.rows[0];
    if (row.status !== 'pending') {
      const err = new Error('This request has already been reviewed');
      err.status = 409;
      err.errorCode = 'ALREADY_REVIEWED';
      throw err;
    }

    await client.query(
      `UPDATE profiles SET inactive_blocked = false, updated_at = NOW() WHERE id = $1`,
      [row.user_id]
    );

    const userMessage = 'Your account has been reactivated.';
    const updateResult = await client.query(
      `UPDATE account_reactivation_requests
       SET status = 'approved',
           reviewed_at = NOW(),
           reviewed_by = $2,
           user_message = $3
       WHERE id = $1
       RETURNING *`,
      [requestId, adminId, userMessage]
    );

    await client.query('COMMIT');
    return updateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function rejectRequest(requestId, adminId, adminNotes = null) {
  await requireTable();

  const reqResult = await db.query(
    `SELECT id, status FROM account_reactivation_requests WHERE id = $1`,
    [requestId]
  );
  if (reqResult.rows.length === 0) {
    const err = new Error('Reactivation request not found');
    err.status = 404;
    throw err;
  }
  if (reqResult.rows[0].status !== 'pending') {
    const err = new Error('This request has already been reviewed');
    err.status = 409;
    err.errorCode = 'ALREADY_REVIEWED';
    throw err;
  }

  const userMessage =
    'Your reactivation request was rejected. Please contact the administrator.';
  const updateResult = await db.query(
    `UPDATE account_reactivation_requests
     SET status = 'rejected',
         reviewed_at = NOW(),
         reviewed_by = $2,
         admin_notes = $3,
         user_message = $4
     WHERE id = $1
     RETURNING *`,
    [requestId, adminId, adminNotes, userMessage]
  );
  return updateResult.rows[0];
}

module.exports = {
  ensureSchemaOnStartup,
  getLatestForUser,
  createRequest,
  listForAdmin,
  approveRequest,
  rejectRequest
};
