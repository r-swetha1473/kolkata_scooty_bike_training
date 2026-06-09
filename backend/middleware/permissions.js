/**
 * Role-based permission middleware (profiles.role + DB permissions for subadmin).
 */

const permissionsService = require('../services/permissions.service');

const PERMISSIONS = {
  superadmin: {
    dashboard: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete'],
    bookings: ['view', 'create', 'edit', 'delete'],
    trainers: ['view', 'create', 'edit', 'delete'],
    vehicles: ['view', 'create', 'edit', 'delete'],
    slots: ['view', 'create', 'edit', 'delete'],
    settings: ['view', 'edit'],
    audit_logs: ['view'],
    sub_admins: ['view', 'create', 'edit', 'delete']
  },
  admin: {
    dashboard: ['view'],
    users: ['view', 'edit'],
    bookings: ['view', 'create', 'edit', 'delete'],
    trainers: ['view', 'create', 'edit', 'delete'],
    vehicles: ['view', 'create', 'edit', 'delete'],
    slots: ['view', 'create', 'edit', 'delete'],
    settings: [],
    audit_logs: [],
    sub_admins: []
  }
};

function getRolePermissions(role) {
  if (role === 'superadmin') return PERMISSIONS.superadmin;
  if (role === 'admin') return PERMISSIONS.admin;
  return {};
}

function hasStaticPermission(role, module, action) {
  const perms = getRolePermissions(role);
  const allowed = perms[module] || [];
  return allowed.includes(action);
}

function hasPermission(user, module, action) {
  if (!user?.role) return false;

  if (user.role === 'superadmin') {
    return hasStaticPermission('superadmin', module, action);
  }

  if (user.role === 'admin') {
    return hasStaticPermission('admin', module, action);
  }

  if (user.role === 'subadmin') {
    return permissionsService.hasDbPermission(user.permissions, module, action);
  }

  return false;
}

const loadUserPermissions = async (req, res, next) => {
  try {
    if (!req.user) return next();

    if (req.user.role === 'subadmin') {
      if (req.user.admin_is_active === false) {
        const error = new Error('Sub admin account is deactivated');
        error.status = 403;
        error.errorCode = 'ADMIN_ACCOUNT_INACTIVE';
        return next(error);
      }
      req.user.permissions = await permissionsService.getPermissionsMap(req.user.id);
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    const error = new Error('Not authenticated');
    error.status = 401;
    error.errorCode = 'NOT_AUTHENTICATED';
    return next(error);
  }
  if (req.user.role !== 'superadmin') {
    const error = new Error('Super admin access required');
    error.status = 403;
    error.errorCode = 'INSUFFICIENT_PERMISSIONS';
    return next(error);
  }
  next();
};

const requirePermission = (module, action) => (req, res, next) => {
  if (!req.user) {
    const error = new Error('Not authenticated');
    error.status = 401;
    error.errorCode = 'NOT_AUTHENTICATED';
    return next(error);
  }

  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    if (req.user.admin_is_active === false) {
      const error = new Error('Admin account is deactivated');
      error.status = 403;
      error.errorCode = 'ADMIN_ACCOUNT_INACTIVE';
      return next(error);
    }
  }

  if (!hasPermission(req.user, module, action)) {
    const error = new Error(`Permission denied: ${module}.${action}`);
    error.status = 403;
    error.errorCode = 'INSUFFICIENT_PERMISSIONS';
    return next(error);
  }
  next();
};

module.exports = {
  PERMISSIONS,
  hasPermission,
  loadUserPermissions,
  requireSuperAdmin,
  requirePermission
};
