import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take, filter, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if token exists first
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // If already authenticated, allow immediately
  if (authService.isAuthenticated()) {
    return true;
  }

  // Wait for profile to load - check current value, then wait for next emission if null
  const currentUser = authService.getUserProfile();
  if (currentUser) {
    return true;
  }

  // Wait for the profile to load with timeout
  // Start with current value, then wait for next emission if needed
  return authService.userProfile$.pipe(
    timeout(3000), // 3 second timeout
    filter(user => user !== null), // Only proceed when user is loaded
    take(1),
    map(user => {
      if (user) {
        return true;
      }
      return false;
    }),
    catchError(() => {
      // Timeout or error - redirect to login
      localStorage.removeItem('token');
      router.navigate(['/'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if token exists first
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // If already authenticated and is admin, allow immediately
  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  // Wait for profile to load and check admin role
  const currentUser = authService.getUserProfile();
  if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
    return true;
  }

  // Wait for the profile to load with timeout
  return authService.userProfile$.pipe(
    timeout(3000), // 3 second timeout
    filter(user => user !== null), // Only proceed when user is loaded
    take(1),
    map(user => {
      if (!user) {
        localStorage.removeItem('token');
        router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      if (user.role === 'admin' || user.role === 'superadmin') {
        return true;
      }

      router.navigate(['/admin/login']);
      return false;
    }),
    catchError(() => {
      // Timeout or error - redirect to login
      localStorage.removeItem('token');
      router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    })
  );
};

export const superAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (authService.isSuperAdmin()) {
    return true;
  }

  router.navigate(['/admin']);
  return false;
};
