/**
 * In-app admin notifications with per-admin read tracking.
 */

const db = require('../db');
const auditService = require('./audit.service');

const NOTIFICATION_TYPES = new Set([
  'expired_booking',
  'new_booking',
  'booking_cancelled',
  'booking_completed',
  'trainer_reassignment',
  'vehicle_availability',
  'slot_capacity',
  'new_customer',
  'sub_admin_action',
  'account_reactivation_request'
]);

async function tableExists(tableName) {
  const r = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return !!r.rows[0]?.exists;
}

async function createNotification({
  type,
  title,
  body = null,
  entity_type = null,
  entity_id = null,
  dedupeHours = 24
}) {
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  const hasTable = await tableExists('admin_notifications');
  if (!hasTable) {
    return null;
  }

  if (entity_id && dedupeHours > 0) {
    const dup = await db.query(
      `SELECT id FROM admin_notifications
       WHERE type = $1 AND entity_id = $2
         AND created_at > NOW() - ($3::text || ' hours')::interval
       LIMIT 1`,
      [type, entity_id, String(dedupeHours)]
    );
    if (dup.rows.length > 0) {
      return dup.rows[0];
    }
  }

  const result = await db.query(
    `INSERT INTO admin_notifications (type, title, body, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [type, title, body, entity_type, entity_id]
  );

  const row = result.rows[0];
  auditService.logNotificationCreated(null, row).catch(() => {});
  return row;
}

async function listNotifications(adminId, { limit = 30, offset = 0, unreadOnly = false } = {}) {
  const hasTable = await tableExists('admin_notifications');
  if (!hasTable) {
    return { notifications: [], total: 0, unreadCount: 0 };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const unreadFilter = unreadOnly
    ? `AND NOT EXISTS (
         SELECT 1 FROM admin_notification_reads r
         WHERE r.notification_id = n.id AND r.admin_id = $1
       )`
    : '';

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM admin_notifications n
     WHERE 1=1 ${unreadFilter}`,
    unreadOnly ? [adminId] : []
  );

  const unreadResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM admin_notifications n
     WHERE NOT EXISTS (
       SELECT 1 FROM admin_notification_reads r
       WHERE r.notification_id = n.id AND r.admin_id = $1
     )`,
    [adminId]
  );

  const listResult = await db.query(
    `SELECT n.*,
            EXISTS (
              SELECT 1 FROM admin_notification_reads r
              WHERE r.notification_id = n.id AND r.admin_id = $1
            ) AS is_read
     FROM admin_notifications n
     WHERE 1=1 ${unreadFilter}
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    unreadOnly ? [adminId, safeLimit, safeOffset] : [adminId, safeLimit, safeOffset]
  );

  return {
    notifications: listResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    unreadCount: unreadResult.rows[0]?.count ?? 0
  };
}

async function getUnreadCount(adminId) {
  const hasTable = await tableExists('admin_notifications');
  if (!hasTable) return 0;

  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM admin_notifications n
     WHERE NOT EXISTS (
       SELECT 1 FROM admin_notification_reads r
       WHERE r.notification_id = n.id AND r.admin_id = $1
     )`,
    [adminId]
  );
  return parseInt(result.rows[0]?.count || 0, 10);
}

async function markRead(adminId, notificationId) {
  const hasTable = await tableExists('admin_notifications');
  if (!hasTable) return;

  await db.query(
    `INSERT INTO admin_notification_reads (notification_id, admin_id)
     VALUES ($1, $2)
     ON CONFLICT (notification_id, admin_id) DO NOTHING`,
    [notificationId, adminId]
  );

  auditService.logNotificationRead(adminId, notificationId).catch(() => {});
}

async function markAllRead(adminId) {
  const hasTable = await tableExists('admin_notifications');
  if (!hasTable) return 0;

  const result = await db.query(
    `INSERT INTO admin_notification_reads (notification_id, admin_id)
     SELECT n.id, $1
     FROM admin_notifications n
     WHERE NOT EXISTS (
       SELECT 1 FROM admin_notification_reads r
       WHERE r.notification_id = n.id AND r.admin_id = $1
     )
     ON CONFLICT DO NOTHING
     RETURNING notification_id`,
    [adminId]
  );
  return result.rows.length;
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead
};
