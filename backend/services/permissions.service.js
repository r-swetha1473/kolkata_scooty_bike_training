/**
 * DB-backed permissions for sub-admin users.
 */

const db = require('../db');

const MODULES = [
  'dashboard',
  'users',
  'trainers',
  'vehicles',
  'bookings',
  'slots',
  'audit_logs',
  'settings'
];

const ACTION_TO_COLUMN = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete'
};

function defaultSubAdminPermissions() {
  return MODULES.map((module) => ({
    module,
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false
  }));
}

async function tableExists() {
  const result = await db.query(
    `SELECT to_regclass('public.sub_admin_permissions') IS NOT NULL AS exists`
  );
  return !!result.rows[0]?.exists;
}

async function getPermissionsMap(profileId) {
  const map = {};
  for (const module of MODULES) {
    map[module] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
  }

  if (!(await tableExists())) {
    return map;
  }

  const result = await db.query(
    `SELECT module, can_view, can_create, can_edit, can_delete
     FROM sub_admin_permissions
     WHERE profile_id = $1`,
    [profileId]
  );

  for (const row of result.rows) {
    map[row.module] = {
      can_view: !!row.can_view,
      can_create: !!row.can_create,
      can_edit: !!row.can_edit,
      can_delete: !!row.can_delete
    };
  }

  return map;
}

async function getPermissionsList(profileId) {
  const map = await getPermissionsMap(profileId);
  return MODULES.map((module) => ({
    module,
    ...map[module]
  }));
}

async function upsertPermissions(profileId, permissionsInput = []) {
  if (!(await tableExists())) {
    return defaultSubAdminPermissions();
  }

  const byModule = {};
  for (const entry of permissionsInput) {
    if (!entry?.module || !MODULES.includes(entry.module)) continue;
    byModule[entry.module] = {
      can_view: !!entry.can_view,
      can_create: !!entry.can_create,
      can_edit: !!entry.can_edit,
      can_delete: !!entry.can_delete
    };
  }

  for (const module of MODULES) {
    const perms = byModule[module] || {
      can_view: module !== 'settings',
      can_create: false,
      can_edit: false,
      can_delete: false
    };

    await db.query(
      `INSERT INTO sub_admin_permissions
         (profile_id, module, can_view, can_create, can_edit, can_delete, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (profile_id, module)
       DO UPDATE SET
         can_view = EXCLUDED.can_view,
         can_create = EXCLUDED.can_create,
         can_edit = EXCLUDED.can_edit,
         can_delete = EXCLUDED.can_delete,
         updated_at = NOW()`,
      [profileId, module, perms.can_view, perms.can_create, perms.can_edit, perms.can_delete]
    );
  }

  return getPermissionsList(profileId);
}

function hasDbPermission(permissionsMap, module, action) {
  const column = ACTION_TO_COLUMN[action];
  if (!column) return false;
  const modulePerms = permissionsMap?.[module];
  if (!modulePerms) return false;
  return modulePerms[column] === true;
}

module.exports = {
  MODULES,
  ACTION_TO_COLUMN,
  defaultSubAdminPermissions,
  getPermissionsMap,
  getPermissionsList,
  upsertPermissions,
  hasDbPermission
};
