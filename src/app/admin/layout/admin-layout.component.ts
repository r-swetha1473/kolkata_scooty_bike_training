import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminHeaderComponent } from '../components/admin-header/admin-header.component';
import { AdminFooterComponent } from '../components/admin-footer/admin-footer.component';
import { ToastComponent } from '../../components/toast/toast.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminHeaderComponent, AdminFooterComponent, ToastComponent],
  template: `
    <div class="admin-layout">
      <app-admin-header></app-admin-header>
      
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>🏍️ Admin Panel</h2>
          <div class="user-info" *ngIf="auth.userProfile$ | async as profile">
            <div class="user-avatar">{{ profile.full_name.charAt(0) }}</div>
            <div class="user-details">
              <div class="user-name">{{ profile.full_name }}</div>
              <div class="user-role">{{ profile.role }}</div>
            </div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>
          <a routerLink="/admin/bookings" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">📅</span>
            <span class="nav-label">Bookings</span>
          </a>
          <a routerLink="/admin/slots" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🕐</span>
            <span class="nav-label">Slots</span>
          </a>
          <a routerLink="/admin/trainers" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">👨‍🏫</span>
            <span class="nav-label">Trainers</span>
          </a>
          <a routerLink="/admin/users" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">👥</span>
            <span class="nav-label">Users</span>
          </a>
          <a routerLink="/admin/settings" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Settings</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button class="btn-secondary" (click)="goToSite()">← Back to Site</button>
          <button class="btn-danger" (click)="logout()">🚪 Logout</button>
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
      background: #f5f7fa;
    }

    .content-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-left: 280px;
      margin-top: 70px;
      height: calc(100vh - 70px);
      overflow: hidden;
    }

    .sidebar {
      width: 280px;
      background: white;
      border-right: 1px solid #e5e7eb;
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
      border-bottom: 1px solid #e5e7eb;
    }

    .sidebar-header h2 {
      margin: 0 0 20px 0;
      font-size: 20px;
      color: #1f2937;
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
    }

    .user-details {
      flex: 1;
    }

    .user-name {
      font-weight: 600;
      color: #1f2937;
      font-size: 14px;
    }

    .user-role {
      font-size: 12px;
      color: #6b7280;
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
      color: #6b7280;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }

    .nav-item:hover {
      background: #f3f4f6;
      color: #1f2937;
    }

    .nav-item.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .nav-icon {
      font-size: 20px;
    }

    .nav-label {
      font-weight: 500;
      font-size: 14px;
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-secondary {
      padding: 10px 16px;
      border: 1px solid #d1d5db;
      background: white;
      color: #4b5563;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    .btn-danger {
      padding: 10px 16px;
      border: none;
      background: #ef4444;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .main-content {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
    }

    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        position: relative;
        height: auto;
        top: 0;
      }

      .content-wrapper {
        margin-left: 0;
        margin-top: 0;
        min-height: auto;
      }

      .main-content {
        padding: 16px;
      }
    }
  `]
})
export class AdminLayoutComponent {
  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  goToSite() {
    this.router.navigate(['/']);
  }

  async logout() {
    await this.auth.signOut();
  }
}
