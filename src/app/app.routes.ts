import { Routes } from '@angular/router';
import { authGuard, adminGuard, activeCustomerGuard, superAdminGuard, passwordChangeRequiredGuard } from './guards/auth.guard';
import { permissionGuard } from './guards/permission.guard';
import { loadWithRetry } from './utils/route-loaders';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      loadWithRetry(() => import('./pages/home/home.component').then((m) => m.HomeComponent))
  },
  {
    path: 'about',
    loadComponent: () =>
      loadWithRetry(() => import('./pages/about/about.component').then((m) => m.AboutComponent))
  },
  {
    path: 'courses',
    loadComponent: () =>
      loadWithRetry(() => import('./pages/courses/courses.component').then((m) => m.CoursesComponent))
  },
  {
    path: 'trainers',
    loadComponent: () =>
      loadWithRetry(() => import('./pages/trainers/trainers.component').then((m) => m.TrainersComponent))
  },
  {
    path: 'contact',
    loadComponent: () =>
      loadWithRetry(() => import('./pages/contact/contact.component').then((m) => m.ContactComponent))
  },
  {
    path: 'booking',
    canActivate: [activeCustomerGuard],
    loadComponent: () =>
      loadWithRetry(() => import('./pages/booking/booking.component').then((m) => m.BookingComponent))
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      loadWithRetry(() => import('./pages/profile/profile.component').then((m) => m.ProfileComponent))
  },
  {
    path: 'my-bookings',
    canActivate: [authGuard],
    loadComponent: () =>
      loadWithRetry(() => import('./pages/my-bookings/my-bookings.component').then((m) => m.MyBookingsComponent))
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      loadWithRetry(() =>
        import('./pages/admin-login/admin-login.component').then((m) => m.AdminLoginComponent)
      )
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      loadWithRetry(() =>
        import('./admin/layout/admin-layout.component').then((m) => m.AdminLayoutComponent)
      ),
    children: [
      {
        path: 'change-password',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/change-password/change-password.component').then(
              (m) => m.AdminChangePasswordComponent
            )
          )
      },
      {
        path: '',
        canActivate: [permissionGuard('dashboard', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent)
          )
      },
      {
        path: 'bookings',
        canActivate: [permissionGuard('bookings', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/bookings/bookings.component').then((m) => m.AdminBookingsComponent)
          )
      },
      {
        path: 'offline-bookings',
        canActivate: [permissionGuard('bookings', 'create'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/offline-bookings/offline-bookings.component').then(
              (m) => m.AdminOfflineBookingsComponent
            )
          )
      },
      {
        path: 'slots',
        canActivate: [permissionGuard('slots', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/slots/slots.component').then((m) => m.AdminSlotsComponent)
          )
      },
      {
        path: 'trainers',
        canActivate: [permissionGuard('trainers', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/trainers/trainers.component').then((m) => m.AdminTrainersComponent)
          )
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/users/users.component').then((m) => m.AdminUsersComponent)
          )
      },
      {
        path: 'reactivation-requests',
        canActivate: [permissionGuard('users', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/reactivation-requests/reactivation-requests.component').then(
              (m) => m.AdminReactivationRequestsComponent
            )
          )
      },
      {
        path: 'vehicles',
        canActivate: [permissionGuard('vehicles', 'view'), passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/vehicles/vehicles.component').then((m) => m.AdminVehiclesComponent)
          )
      },
      {
        path: 'sub-admins',
        canActivate: [superAdminGuard, passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/sub-admins/sub-admins.component').then((m) => m.AdminSubAdminsComponent)
          )
      },
      {
        path: 'settings',
        canActivate: [superAdminGuard, passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/settings/settings.component').then((m) => m.AdminSettingsComponent)
          )
      },
      {
        path: 'audit-logs',
        canActivate: [superAdminGuard, passwordChangeRequiredGuard],
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/audit-logs/audit-logs.component').then((m) => m.AdminAuditLogsComponent)
          )
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
