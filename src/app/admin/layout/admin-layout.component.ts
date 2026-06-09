import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';
import { AdminHeaderComponent } from '../components/admin-header/admin-header.component';
import { AdminFooterComponent } from '../components/admin-footer/admin-footer.component';
import { ToastComponent } from '../../components/toast/toast.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminHeaderComponent, AdminFooterComponent, ToastComponent],
  template: `
    <div class="admin-layout" [class.sidebar-open]="sidebarOpen">
      <app-admin-header (menuToggle)="toggleSidebar()"></app-admin-header>

      <div
        class="sidebar-overlay"
        *ngIf="sidebarOpen"
        (click)="closeSidebar()"
        aria-hidden="true">
      </div>
      
      <aside class="sidebar" [class.open]="sidebarOpen">
        <div class="sidebar-header">
          <h2>Admin Panel</h2>
          <div class="user-info" *ngIf="auth.userProfile$ | async as profile">
            <div class="user-avatar">{{ profile.full_name.charAt(0) }}</div>
            <div class="user-details">
              <div class="user-name">{{ profile.full_name }}</div>
              <div class="user-role">{{ profile.role }}</div>
            </div>
          </div>
        </div>

        <nav class="sidebar-nav" *ngIf="auth.userProfile$ | async as profile">
          <a *ngIf="perms.canViewModule('dashboard')" routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span class="nav-label">Dashboard</span>
          </a>
          <a *ngIf="perms.canViewModule('users')" routerLink="/admin/users" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="nav-label">Users</span>
          </a>
          <a *ngIf="perms.canViewModule('trainers')" routerLink="/admin/trainers" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="nav-label">Trainers</span>
          </a>
          <a *ngIf="perms.canViewModule('vehicles')" routerLink="/admin/vehicles" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"></path>
              <polygon points="12 15 17 21 7 21 12 15"></polygon>
            </svg>
            <span class="nav-label">Vehicles</span>
          </a>
          <a *ngIf="perms.canViewModule('bookings')" routerLink="/admin/bookings" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="nav-label">Bookings</span>
          </a>
          <a *ngIf="perms.canViewModule('slots')" routerLink="/admin/slots" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="nav-label">Slots</span>
          </a>
          <a *ngIf="profile.role === 'superadmin'" routerLink="/admin/audit-logs" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="nav-label">Audit Logs</span>
          </a>
          <a *ngIf="profile.role === 'superadmin'" routerLink="/admin/settings" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3"></path>
            </svg>
            <span class="nav-label">Settings</span>
          </a>
          <a *ngIf="profile.role === 'superadmin'" routerLink="/admin/sub-admins" routerLinkActive="active" class="nav-item" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="22" y1="11" x2="16" y2="11"></line>
            </svg>
            <span class="nav-label">Sub Admins</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <a routerLink="/admin/change-password" class="nav-item profile-link" (click)="closeSidebar()">
            <svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span class="nav-label">Change Password</span>
          </a>
          <button class="btn-secondary" (click)="goToSite()">Back to Site</button>
          <button class="btn-danger" (click)="logout()">Logout</button>
        </div>
      </aside>

      <div class="content-wrapper">
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
        
        <app-admin-footer></app-admin-footer>
      </div>
      <app-toast></app-toast>
    </div>
  `,
  styles: [`
    .admin-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: var(--background-color);
    }

    .content-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-left: 280px;
      margin-top: 70px;
      min-height: calc(100vh - 70px);
    }

    .main-content {
      flex: 1;
    }

    .sidebar {
      width: 280px;
      background: #1F2937;
      border-right: 1px solid rgba(229, 231, 235, 0.1);
      display: flex;
      flex-direction: column;
      position: fixed;
      height: calc(100vh - 70px);
      top: 70px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid rgba(229, 231, 235, 0.1);
    }

    .sidebar-header h2 {
      margin: 0 0 20px 0;
      font-size: 20px;
      color: #F9FAFB;
      font-weight: 700;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(0, 102, 177, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #60A5FA;
      font-weight: 600;
      font-size: 16px;
    }

    .user-details {
      flex: 1;
    }

    .user-name {
      font-weight: 500;
      color: #F9FAFB;
      font-size: 14px;
    }

    .user-role {
      font-size: 12px;
      color: #9CA3AF;
      text-transform: capitalize;
    }

    .sidebar-nav {
      flex: 1;
      padding: 16px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 4px;
      border-radius: 8px;
      color: #9CA3AF;
      text-decoration: none;
      transition: all var(--transition-base);
      cursor: pointer;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #F9FAFB;
    }

    .nav-item.active {
      background: rgba(0, 102, 177, 0.15);
      color: #FFFFFF;
      border-left: 3px solid #0066B1;
      font-weight: 500;
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      stroke-width: 2;
      flex-shrink: 0;
    }

    .nav-label {
      font-weight: 500;
      font-size: 14px;
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid rgba(229, 231, 235, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .profile-link {
      margin-bottom: 4px;
      text-decoration: none;
    }

    .btn-secondary {
      padding: 10px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: #9CA3AF;
      border-radius: var(--border-radius-md);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-base);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
      color: #F9FAFB;
    }

    .btn-danger {
      padding: 10px 16px;
      border: 1px solid rgba(220, 38, 38, 0.3);
      background: transparent;
      color: #FCA5A5;
      border-radius: var(--border-radius-md);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-danger:hover {
      background: rgba(220, 38, 38, 0.15);
      border-color: rgba(220, 38, 38, 0.5);
      color: #FEE2E2;
    }

    .main-content {
      flex: 1;
      padding: 40px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      background: #F9FAFB;
    }

    .sidebar-overlay {
      display: none;
    }

    @media (max-width: 1024px) and (min-width: 769px) {
      .main-content {
        padding: 24px 20px;
      }
    }

    @media (max-width: 768px) {
      .sidebar-overlay {
        display: block;
        position: fixed;
        inset: 70px 0 0 0;
        background: rgba(17, 24, 39, 0.45);
        z-index: 150;
      }

      .sidebar {
        width: min(280px, 85vw);
        position: fixed;
        height: calc(100vh - 70px);
        top: 70px;
        left: 0;
        z-index: 200;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .content-wrapper {
        margin-left: 0;
        margin-top: 70px;
        height: calc(100vh - 70px);
        min-height: auto;
      }

      .main-content {
        padding: 16px;
      }
    }

    @media (max-width: 425px) {
      .sidebar {
        width: min(260px, 90vw);
      }

      .sidebar-header {
        padding: 16px;
      }

      .sidebar-header h2 {
        font-size: 17px;
      }

      .nav-label {
        font-size: 13px;
      }

      .main-content {
        padding: 12px;
      }
    }

    @media (max-width: 320px) {
      .sidebar-footer .btn-secondary,
      .sidebar-footer .btn-danger {
        font-size: 13px;
        padding: 10px 12px;
      }

      .main-content {
        padding: 8px;
      }
    }
  `]
})
export class AdminLayoutComponent {
  sidebarOpen = false;

  constructor(
    public auth: AuthService,
    public perms: PermissionService,
    private router: Router
  ) {}

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar() {
    this.sidebarOpen = false;
  }

  goToSite() {
    this.router.navigate(['/']);
  }

  async logout() {
    await this.auth.signOut();
  }
}
