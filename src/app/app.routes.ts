import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'courses',
    loadComponent: () => import('./pages/courses/courses.component').then(m => m.CoursesComponent)
  },
  {
    path: 'trainers',
    loadComponent: () => import('./pages/trainers/trainers.component').then(m => m.TrainersComponent)
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent)
  },
  {
    path: 'booking',
    loadComponent: () => import('./pages/booking/booking.component').then(m => m.BookingComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./admin/pages/dashboard/dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'bookings',
        loadComponent: () => import('./admin/pages/bookings/bookings.component').then(m => m.AdminBookingsComponent)
      },
      {
        path: 'slots',
        loadComponent: () => import('./admin/pages/slots/slots.component').then(m => m.AdminSlotsComponent)
      },
      {
        path: 'trainers',
        loadComponent: () => import('./admin/pages/trainers/trainers.component').then(m => m.AdminTrainersComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./admin/pages/users/users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./admin/pages/settings/settings.component').then(m => m.AdminSettingsComponent)
      },
      {
        path: 'audit',
        loadComponent: () => import('./admin/pages/audit/audit.component').then(m => m.AdminAuditComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
