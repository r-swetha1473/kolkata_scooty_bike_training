const { authenticate, authorize } = require('./auth');
const { loadUserPermissions, requirePermission } = require('./permissions');

/**
 * Standard admin mutation guard: authenticate → load DB permissions → role check → action check.
 */
function adminAccess(module, action) {
  return [
    authenticate,
    loadUserPermissions,
    authorize('admin', 'superadmin', 'subadmin'),
    requirePermission(module, action)
  ];
}

module.exports = { adminAccess };
