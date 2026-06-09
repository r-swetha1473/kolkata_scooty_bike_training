import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { PermissionService, PermissionModule, PermissionAction } from '../services/permission.service';
import { AuthService } from '../services/auth.service';

export function permissionGuard(module: PermissionModule, action: PermissionAction = 'view'): CanActivateFn {
  return () => {
    const permissions = inject(PermissionService);
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      router.navigate(['/admin/login']);
      return false;
    }

    if (permissions.can(module, action)) {
      return true;
    }

    const fallback = permissions.getFirstAllowedAdminRoute();
    router.navigateByUrl(fallback === '/admin/login' ? '/admin/login' : fallback);
    return false;
  };
}
