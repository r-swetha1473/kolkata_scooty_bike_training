import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="admin-header">
      <div class="header-container">
        <div class="header-left">
          <div class="logo">
            <span class="logo-icon">🏍️</span>
            <div class="logo-text">
              <h1>Kolkata Scotty</h1>
              <span class="logo-subtitle">Admin Panel</span>
            </div>
          </div>
        </div>

        <div class="header-right">
          <div class="header-actions">
            <button class="action-btn" (click)="goToSite()" title="Go to main site">
              <span class="icon">🌐</span>
              <span class="text">Site</span>
            </button>
            
            <div class="user-menu" *ngIf="auth.userProfile$ | async as profile">
              <button class="user-btn" (click)="toggleUserMenu()">
                <div class="user-avatar">{{ profile.full_name.charAt(0).toUpperCase() }}</div>
                <div class="user-info-text">
                  <span class="user-name">{{ profile.full_name }}</span>
                  <span class="user-role">{{ profile.role | titlecase }}</span>
                </div>
                <span class="dropdown-icon" [class.rotated]="showUserMenu">▼</span>
              </button>
              <div class="dropdown-menu" *ngIf="showUserMenu">
                <div class="dropdown-item" (click)="goToSite()">
                  <span class="menu-icon">🌐</span>
                  <span>Back to Site</span>
                </div>
                <div class="dropdown-item" (click)="logout()">
                  <span class="menu-icon">🚪</span>
                  <span>Logout</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .admin-header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      height: 70px;
    }

    .header-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 0 32px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      font-size: 32px;
    }

    .logo-text h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-right {
      display: flex;
      align-items: center;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      color: #4b5563;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: #e5e7eb;
      color: #1f2937;
    }

    .action-btn .icon {
      font-size: 16px;
    }

    .user-menu {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .user-btn:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }

    .user-info-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.2;
    }

    .user-role {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.2;
    }

    .dropdown-icon {
      font-size: 10px;
      color: #6b7280;
      transition: transform 0.2s;
      margin-left: 4px;
    }

    .dropdown-icon.rotated {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 200px;
      overflow: hidden;
      z-index: 1000;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: #4b5563;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .dropdown-item:hover {
      background: #f9fafb;
    }

    .dropdown-item:first-child {
      border-bottom: 1px solid #e5e7eb;
    }

    .menu-icon {
      font-size: 16px;
    }

    @media (max-width: 768px) {
      .header-container {
        padding: 0 16px;
      }

      .logo-text h1 {
        font-size: 18px;
      }

      .logo-subtitle {
        font-size: 10px;
      }

      .action-btn .text {
        display: none;
      }

      .user-info-text {
        display: none;
      }
    }
  `]
})
export class AdminHeaderComponent {
  showUserMenu = false;

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
    
    if (this.showUserMenu) {
      // Close menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', this.closeUserMenu);
      }, 0);
    }
  }

  closeUserMenu = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.showUserMenu = false;
      document.removeEventListener('click', this.closeUserMenu);
    }
  }

  goToSite() {
    this.showUserMenu = false;
    this.router.navigate(['/']);
  }

  async logout() {
    this.showUserMenu = false;
    await this.auth.signOut();
  }
}

