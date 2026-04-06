import { Routes } from '@angular/router';
import { authGuard, adminGuard, activeCustomerGuard } from './guards/auth.guard';
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
        path: '',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent)
          )
      },
      {
        path: 'bookings',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/bookings/bookings.component').then((m) => m.AdminBookingsComponent)
          )
      },
      {
        path: 'slots',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/slots-info/slots-info.component').then((m) => m.AdminSlotsInfoComponent)
          )
      },
      {
        path: 'trainers',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/trainers/trainers.component').then((m) => m.AdminTrainersComponent)
          )
      },
      {
        path: 'users',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/users/users.component').then((m) => m.AdminUsersComponent)
          )
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/vehicles/vehicles.component').then((m) => m.AdminVehiclesComponent)
          )
      },
      {
        path: 'settings',
        loadComponent: () =>
          loadWithRetry(() =>
            import('./admin/pages/settings/settings.component').then((m) => m.AdminSettingsComponent)
          )
      },
      {
        path: 'audit-logs',
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
