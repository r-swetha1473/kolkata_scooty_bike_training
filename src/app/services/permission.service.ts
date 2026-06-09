import { Injectable } from '@angular/core';
import { AuthService, ModulePermission, UserProfile } from './auth.service';

export type PermissionModule =
  | 'dashboard'
  | 'users'
  | 'trainers'
  | 'vehicles'
  | 'bookings'
  | 'slots'
  | 'audit_logs'
  | 'settings';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  constructor(private auth: AuthService) {}

  can(module: PermissionModule, action: PermissionAction): boolean {
    const profile = this.auth.getUserProfile();
    if (!profile) return false;

    if (profile.role === 'superadmin') return true;

    if (profile.role === 'admin') {
      const matrix: Record<string, PermissionAction[]> = {
        dashboard: ['view'],
        users: ['view', 'edit'],
        bookings: ['view', 'create', 'edit', 'delete'],
        trainers: ['view', 'create', 'edit', 'delete'],
        vehicles: ['view', 'create', 'edit', 'delete'],
        slots: ['view', 'create', 'edit', 'delete'],
        settings: [],
        audit_logs: []
      };
      return (matrix[module] || []).includes(action);
    }

    if (profile.role === 'subadmin') {
      const perms = this.getModulePermission(profile, module);
      if (!perms) return false;
      if (action === 'view') return perms.can_view;
      if (action === 'create') return perms.can_create;
      if (action === 'edit') return perms.can_edit;
      if (action === 'delete') return perms.can_delete;
    }

    return false;
  }

  canViewModule(module: PermissionModule): boolean {
    return this.can(module, 'view');
  }

  private getModulePermission(profile: UserProfile, module: PermissionModule): ModulePermission | undefined {
    return profile.permissions?.find((p) => p.module === module);
  }
}
