import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take, filter, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { clearAuthToken } from '../utils/auth-token.storage';

export const activeCustomerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const profile = authService.getUserProfile();
  if (profile?.role === 'customer' && profile.inactive_blocked === true) {
    router.navigate(['/profile'], { queryParams: { inactive: '1' } });
    return false;
  }

  return true;
};

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  const currentUser = authService.getUserProfile();
  if (currentUser) {
    return true;
  }

  authService.reloadUserProfile();

  return authService.userProfile$.pipe(
    timeout(5000),
    filter((user) => user !== null),
    take(1),
    map((user) => !!user),
    catchError(() => {
      clearAuthToken();
      router.navigate(['/'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.getUserProfile();
  if (currentUser && authService.isAdmin()) {
    if (currentUser.admin_is_active === false) {
      router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url, inactive: '1' } });
      return false;
    }
    return true;
  }

  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  authService.reloadUserProfile();

  return authService.userProfile$.pipe(
    timeout(5000),
    filter((user) => user !== null),
    take(1),
    map((user) => {
      if (!user || !['admin', 'superadmin', 'subadmin'].includes(user.role)) {
        router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
      if (user.admin_is_active === false) {
        router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url, inactive: '1' } });
        return false;
      }
      return true;
    }),
    catchError(() => {
      clearAuthToken();
      router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};

export const passwordChangeRequiredGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (state.url.includes('/admin/change-password')) {
    return true;
  }

  const profile = authService.getUserProfile();
  if (profile) {
    if (profile.must_change_password) {
      router.navigate(['/admin/change-password']);
      return false;
    }
    return true;
  }

  return authService.userProfile$.pipe(
    filter((user) => user !== null),
    take(1),
    map((user) => {
      if (user?.must_change_password) {
        router.navigate(['/admin/change-password']);
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};

export const superAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (authService.isSuperAdmin()) {
    return true;
  }

  router.navigate(['/admin']);
  return false;
};
