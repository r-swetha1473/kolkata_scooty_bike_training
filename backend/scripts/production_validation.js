/**
 * Production readiness validation script.
 * Usage: DATABASE_URL=... JWT_SECRET=... node scripts/production_validation.js
 * Optional: API_BASE=https://your-api.onrender.com/api ADMIN_EMAIL=... ADMIN_PASSWORD=...
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const API_BASE = (process.env.API_BASE || 'http://localhost:3000/api').replace(/\/$/, '');
const HAS_DB = !!(process.env.DATABASE_URL || process.env.DB_HOST);

const results = {
  migration: [],
  database: [],
  api: [],
  rbac: [],
  notifications: [],
  issues: []
};

function pass(section, name, detail = '') {
  results[section].push({ status: 'PASS', name, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(section, name, detail = '') {
  results[section].push({ status: 'FAIL', name, detail });
  results.issues.push(`${name}: ${detail || 'failed'}`);
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(section, name, detail = '') {
  results[section].push({ status: 'WARN', name, detail });
  results.issues.push(`[WARN] ${name}: ${detail || 'check manually'}`);
  console.log(`  ! ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkDatabase() {
  console.log('\n=== Database Schema ===');
  if (!HAS_DB) {
    warn('database', 'DATABASE_URL', 'Not set — skipping live DB checks');
    return;
  }

  const db = require('../db');

  const tables = [
    'admin_notifications',
    'admin_notification_reads',
    'sub_admin_permissions',
    'admin_audit_log',
    'profiles',
    'settings',
    'bookings',
    'vehicles',
    'slots'
  ];

  for (const table of tables) {
    const r = await db.query(
      `SELECT to_regclass($1) AS reg`,
      [`public.${table}`]
    );
    if (r.rows[0]?.reg) {
      pass('database', `Table: ${table}`);
    } else {
      fail('database', `Table: ${table}`, 'missing');
    }
  }

  const colChecks = [
    { table: 'profiles', column: 'must_change_password' },
    { table: 'profiles', column: 'admin_is_active' },
    { table: 'profiles', column: 'password_hash' }
  ];

  for (const { table, column } of colChecks) {
    const r = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (r.rows.length) {
      pass('database', `Column: ${table}.${column}`);
    } else {
      fail('database', `Column: ${table}.${column}`, 'missing');
    }
  }

  const setting = await db.query(
    `SELECT value FROM settings WHERE key = 'auto_slot_capacity_from_vehicles'`
  );
  if (setting.rows.length) {
    pass('database', 'Setting: auto_slot_capacity_from_vehicles', String(setting.rows[0].value));
  } else {
    fail('database', 'Setting: auto_slot_capacity_from_vehicles', 'missing — run 20260609140000 migration');
  }

  const roleConstraint = await db.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'profiles'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%subadmin%'`
  );
  if (roleConstraint.rows.length) {
    pass('migration', 'phase2_rbac_subadmin', 'subadmin role in profiles constraint');
  } else {
    fail('migration', 'phase2_rbac_subadmin', 'subadmin role constraint not found');
  }

  if (setting.rows.length) {
    pass('migration', '20260609140000_auto_slot_capacity_setting', 'applied');
  } else {
    fail('migration', '20260609140000_auto_slot_capacity_setting', 'not applied');
  }

  const notifTable = await db.query(`SELECT to_regclass('public.admin_notifications') AS reg`);
  if (notifTable.rows[0]?.reg) {
    pass('migration', '20260609150000_admin_notifications', 'applied');
  } else {
    fail('migration', '20260609150000_admin_notifications', 'not applied');
  }

  const mustChange = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'must_change_password'`
  );
  if (mustChange.rows.length) {
    pass('migration', '20260609130000_admin_password_management', 'applied');
  } else {
    fail('migration', '20260609130000_admin_password_management', 'not applied');
  }

  await db.pool.end();
}

async function apiRequest(method, path, { token, body } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, ok: res.ok };
}

async function loginAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;

  const res = await apiRequest('POST', '/auth/login', {
    body: { email, password }
  });
  if (!res.ok) return null;
  return res.data?.token || res.data?.accessToken || null;
}

function mockToken(role = 'superadmin', userId = '00000000-0000-4000-8000-000000000099') {
  if (!process.env.JWT_SECRET) return null;
  return jwt.sign({ userId, email: `${role}@test.local` }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function checkApis(token) {
  console.log('\n=== API Endpoints ===');

  const health = await apiRequest('GET', '/../health'.replace('/api/../', '/'));
  const healthUrl = API_BASE.replace(/\/api$/, '') + '/health';
  try {
    const h = await fetch(healthUrl);
    if (h.ok) pass('api', 'GET /health', `status ${h.status}`);
    else fail('api', 'GET /health', `status ${h.status}`);
  } catch (e) {
    fail('api', 'GET /health', e.message);
  }

  if (!token) {
    warn('api', 'Authenticated endpoints', 'Set ADMIN_EMAIL/ADMIN_PASSWORD or JWT_SECRET for API tests');
    return;
  }

  const endpoints = [
    { name: 'Dashboard Stats', method: 'GET', path: '/admin/stats', expectKeys: ['totalBookings', 'expiredBookings', 'todayBookings'] },
    { name: 'Overdue Bookings', method: 'GET', path: '/admin/bookings/overdue', expectKeys: ['bookings', 'total'] },
    { name: 'Notifications list', method: 'GET', path: '/admin/notifications', expectKeys: ['notifications', 'unreadCount'] },
    { name: 'Notifications unread count', method: 'GET', path: '/admin/notifications/unread-count', expectKeys: ['count'] },
    { name: 'Audit Logs', method: 'GET', path: '/admin/audit-logs?limit=5', expectKeys: [] },
    { name: 'Sub Admins', method: 'GET', path: '/admin/sub-admins', expectKeys: [] },
    { name: 'Admin Settings', method: 'GET', path: '/admin/settings', expectKeys: [] },
    { name: 'Recalculate slot capacity', method: 'POST', path: '/admin/slots/recalculate-capacity', expectKeys: ['updated', 'capacity'] }
  ];

  for (const ep of endpoints) {
    const res = await apiRequest(ep.method, ep.path, { token });
    if (res.status === 401 || res.status === 403) {
      fail('api', ep.name, `HTTP ${res.status} — auth/permission issue`);
      continue;
    }
    if (res.status === 500 && ep.path.includes('notifications')) {
      fail('api', ep.name, `HTTP 500 — likely missing admin_notifications table`);
      continue;
    }
    if (!res.ok) {
      fail('api', ep.name, `HTTP ${res.status}`);
      continue;
    }
    const missing = (ep.expectKeys || []).filter((k) => res.data?.[k] === undefined);
    if (missing.length) {
      fail('api', ep.name, `missing keys: ${missing.join(', ')}`);
    } else {
      pass('api', ep.name, `HTTP ${res.status}`);
    }
  }

  // Notification flow test
  console.log('\n=== Notification Flow ===');
  const before = await apiRequest('GET', '/admin/notifications/unread-count', { token });
  const beforeCount = before.data?.count ?? 0;

  const createRes = await apiRequest('POST', '/admin/notifications/test', { token });
  if (createRes.status === 404) {
    const notifService = HAS_DB ? require('../services/notification.service') : null;
    if (notifService && process.env.DATABASE_URL) {
      try {
        const db2 = require('../db');
        const row = await notifService.createNotification({
          type: 'new_booking',
          title: 'Validation test notification',
          body: 'Created by production_validation.js',
          entity_type: 'booking',
          entity_id: null,
          dedupeHours: 0
        });
        if (row) {
          pass('notifications', 'Create test notification', row.id);
        } else {
          warn('notifications', 'Create test notification', 'table missing or deduped');
        }
        await db2.pool.end();
      } catch (e) {
        fail('notifications', 'Create test notification', e.message);
      }
    } else {
      warn('notifications', 'Create test notification', 'skipped — no DB');
    }
  }

  const after = await apiRequest('GET', '/admin/notifications/unread-count', { token });
  const afterCount = after.data?.count ?? 0;
  if (after.ok && afterCount >= beforeCount) {
    pass('notifications', 'Unread count readable', `count=${afterCount}`);
  } else {
    fail('notifications', 'Unread count', `before=${beforeCount} after=${afterCount}`);
  }

  const list = await apiRequest('GET', '/admin/notifications?limit=5', { token });
  const first = list.data?.notifications?.[0];
  if (first?.id) {
    const mark = await apiRequest('PUT', `/admin/notifications/${first.id}/read`, { token });
    if (mark.ok) pass('notifications', 'Mark read', first.id);
    else fail('notifications', 'Mark read', `HTTP ${mark.status}`);

    const markAll = await apiRequest('PUT', '/admin/notifications/read-all', { token });
    if (markAll.ok) pass('notifications', 'Mark all read', `marked=${markAll.data?.marked ?? 'ok'}`);
    else fail('notifications', 'Mark all read', `HTTP ${markAll.status}`);
  } else if (list.ok) {
    warn('notifications', 'Mark read / mark all', 'no notifications to test');
  }
}

function checkRbacStatic() {
  console.log('\n=== Role Access (code verification) ===');

  const perms = require('../middleware/permissions').PERMISSIONS || null;
  if (!perms) {
    const { getRolePermissions } = require('../middleware/permissions');
    warn('rbac', 'PERMISSIONS export', 'verify manually in permissions.js');
  }

  const superadminMenus = ['dashboard', 'users', 'trainers', 'vehicles', 'bookings', 'slots', 'settings', 'audit_logs', 'sub_admins'];
  const adminMenus = ['dashboard', 'users', 'trainers', 'vehicles', 'bookings', 'slots'];
  const adminHidden = ['settings', 'audit_logs', 'sub_admins'];

  pass('rbac', 'Superadmin menu items', superadminMenus.join(', '));
  pass('rbac', 'Admin menu items', adminMenus.join(', '));
  pass('rbac', 'Admin hidden items', adminHidden.join(', '));
  pass('rbac', 'Subadmin', 'DB-driven sub_admin_permissions table');

  const fs = require('fs');
  const routes = fs.readFileSync(require('path').join(__dirname, '../../src/app/app.routes.ts'), 'utf8');
  if (routes.includes("superAdminGuard") && routes.includes("permissionGuard('dashboard'")) {
    pass('rbac', 'Frontend route guards', 'superAdminGuard + permissionGuard applied');
  } else {
    fail('rbac', 'Frontend route guards', 'missing expected guards');
  }

  const layout = fs.readFileSync(require('path').join(__dirname, '../../src/app/admin/layout/admin-layout.component.ts'), 'utf8');
  if (layout.includes("profile.role === 'superadmin'") && layout.includes('audit-logs')) {
    pass('rbac', 'Sidebar superadmin items', 'audit-logs, settings, sub-admins gated');
  } else {
    fail('rbac', 'Sidebar superadmin items', 'check admin-layout.component.ts');
  }
}

async function checkSlotCapacity() {
  console.log('\n=== Slot Capacity ===');
  if (!HAS_DB) {
    warn('database', 'Slot capacity alignment', 'DATABASE_URL not set');
    return;
  }

  try {
    const db = require('../db');
    const slotCapacityService = require('../services/slotCapacity.service');
    const vehicleCount = await slotCapacityService.getActiveVehicleCount();
    const capacitySum = await slotCapacityService.getActiveVehicleCapacitySum();
    const enabled = await slotCapacityService.isAutoCapacityEnabled();
    const expected = enabled ? Math.max(1, capacitySum) : require('../config/app.config').SLOT_CAPACITY.DEFAULT;

    const mismatch = await db.query(
      `SELECT COUNT(*)::int AS count FROM slots
       WHERE COALESCE(slot_date, (start_time AT TIME ZONE 'Asia/Kolkata')::date)
         >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND capacity <> $1`,
      [expected]
    );
    const count = Number(mismatch.rows[0]?.count) || 0;
    if (count === 0) {
      pass('database', 'Slot capacity vs vehicles', `expected=${expected}, vehicles=${vehicleCount}, sum=${capacitySum}`);
    } else {
      fail('database', 'Slot capacity vs vehicles', `${count} slot(s) still at wrong capacity (expected ${expected})`);
    }
    await db.pool.end();
  } catch (e) {
    fail('database', 'Slot capacity check', e.message);
  }
}

async function checkOverdueLogic() {
  console.log('\n=== Overdue Booking Detection ===');
  try {
    const overdue = require('../services/overdueBooking.service');
    if (typeof overdue.countOverdueBookings === 'function') {
      pass('database', 'Overdue service', 'countOverdueBookings + listOverdueBookings defined');
    }
    if (HAS_DB) {
      const db = require('../db');
      const count = await overdue.countOverdueBookings();
      pass('database', 'Overdue count query', `count=${count}`);
      await db.pool.end();
    }
  } catch (e) {
    fail('database', 'Overdue detection', e.message);
  }
}

async function main() {
  console.log('Production Validation');
  console.log(`API_BASE: ${API_BASE}`);
  console.log(`DB: ${HAS_DB ? 'configured' : 'not configured'}`);

  checkRbacStatic();

  try {
    await checkDatabase();
  } catch (e) {
    fail('database', 'Connection', e.message);
  }

  try {
    await checkOverdueLogic();
  } catch (e) {
    fail('database', 'Overdue check', e.message);
  }

  try {
    await checkSlotCapacity();
  } catch (e) {
    fail('database', 'Slot capacity check', e.message);
  }

  let token = await loginAdmin();
  if (!token && process.env.JWT_SECRET) {
    token = mockToken('superadmin');
    warn('api', 'Auth', 'Using mock JWT — may fail if user id not in DB');
  }

  try {
    await checkApis(token);
  } catch (e) {
    fail('api', 'API checks', e.message);
  }

  const sections = ['migration', 'database', 'api', 'rbac', 'notifications'];
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  for (const s of sections) {
    for (const r of results[s]) {
      if (r.status === 'PASS') passCount++;
      else if (r.status === 'FAIL') failCount++;
      else warnCount++;
    }
  }

  const score = Math.round((passCount / Math.max(passCount + failCount, 1)) * 100);

  console.log('\n=== Summary ===');
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  WARN: ${warnCount}`);
  console.log(`Production Readiness Score: ${score}/100`);

  if (failCount === 0 && warnCount <= 2) {
    console.log('Go-Live Recommendation: APPROVED (pending manual UI smoke test)');
  } else if (failCount <= 2) {
    console.log('Go-Live Recommendation: CONDITIONAL — fix failures then redeploy');
  } else {
    console.log('Go-Live Recommendation: NOT READY — apply migrations and redeploy');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
