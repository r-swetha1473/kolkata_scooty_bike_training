import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { NotificationService, AdminNotification } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="admin-header">
      <div class="header-container">
        <div class="header-left">
          <button
            type="button"
            class="menu-toggle"
            (click)="menuToggle.emit()"
            aria-label="Toggle navigation menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div class="logo">
            <div class="logo-text">
              <h1>Kolkata Scotty</h1>
              <span class="logo-subtitle">Admin Panel</span>
            </div>
          </div>
        </div>

        <div class="header-right">
          <div class="header-actions">
            <div class="notification-menu" *ngIf="canViewNotifications">
              <button
                type="button"
                class="notification-btn"
                (click)="toggleNotifications($event)"
                title="Notifications"
                aria-label="Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="notification-badge" *ngIf="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
              </button>
              <div class="notification-panel" *ngIf="showNotifications" (click)="$event.stopPropagation()">
                <div class="notification-panel-header">
                  <span>Notifications</span>
                  <button type="button" class="mark-all-btn" *ngIf="unreadCount > 0" (click)="markAllRead()">Mark all read</button>
                </div>
                <div class="notification-loading" *ngIf="notificationsLoading">Loading…</div>
                <div class="notification-empty" *ngIf="!notificationsLoading && notifications.length === 0">
                  No notifications
                </div>
                <div class="notification-list" *ngIf="!notificationsLoading && notifications.length > 0">
                  <button
                    type="button"
                    class="notification-item"
                    *ngFor="let n of notifications"
                    [class.unread]="!n.is_read"
                    (click)="openNotification(n)">
                    <div class="notification-title">{{ n.title }}</div>
                    <div class="notification-body" *ngIf="n.body">{{ n.body }}</div>
                    <div class="notification-time">{{ formatTime(n.created_at) }}</div>
                  </button>
                </div>
              </div>
            </div>

            <button class="action-btn" (click)="goToSite()" title="Go to main site">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span class="text">Site</span>
            </button>
            
            <div class="user-menu" *ngIf="auth.userProfile$ | async as profile">
              <button class="user-btn" (click)="toggleUserMenu()">
                <div class="user-avatar">{{ profile.full_name.charAt(0).toUpperCase() }}</div>
                <div class="user-info-text">
                  <span class="user-name">{{ profile.full_name }}</span>
                  <span class="user-role">{{ profile.role | titlecase }}</span>
                </div>
                <svg class="dropdown-icon" [class.rotated]="showUserMenu" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="dropdown-menu" *ngIf="showUserMenu">
                <div class="dropdown-item" (click)="goToSite()">
                  <svg class="menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  <span>Back to Site</span>
                </div>
                <div class="dropdown-item" (click)="logout()">
                  <svg class="menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
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
      background: #FFFFFF;
      border-bottom: 1px solid #E5E7EB;
      box-shadow: none;
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
      gap: 12px;
    }

    .menu-toggle {
      display: none;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      background: #FFFFFF;
      color: #374151;
      cursor: pointer;
      flex-shrink: 0;
    }

    .menu-toggle:hover {
      background: #F9FAFB;
      border-color: #D1D5DB;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-text h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      line-height: 1.2;
    }

    .logo-subtitle {
      font-size: 12px;
      color: #6B7280;
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

    .notification-menu {
      position: relative;
    }

    .notification-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      background: #FFFFFF;
      color: #4B5563;
      cursor: pointer;
      transition: all 0.2s;
    }

    .notification-btn:hover {
      background: #F9FAFB;
      border-color: #D1D5DB;
      color: #111827;
    }

    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: #EF4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .notification-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: min(360px, 90vw);
      max-height: 420px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      z-index: 1100;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .notification-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #E5E7EB;
      font-weight: 600;
      font-size: 14px;
      color: #111827;
    }

    .mark-all-btn {
      border: none;
      background: none;
      color: #0066B1;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
    }

    .notification-list {
      overflow-y: auto;
      max-height: 340px;
    }

    .notification-item {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      border-bottom: 1px solid #F3F4F6;
      background: #FFFFFF;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .notification-item:hover {
      background: #F9FAFB;
    }

    .notification-item.unread {
      background: #EFF6FF;
    }

    .notification-title {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }

    .notification-body {
      font-size: 12px;
      color: #6B7280;
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .notification-time {
      font-size: 11px;
      color: #9CA3AF;
    }

    .notification-empty,
    .notification-loading {
      padding: 24px 16px;
      text-align: center;
      color: #6B7280;
      font-size: 13px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: var(--border-radius-md);
      color: #4B5563;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-base);
    }

    .action-btn:hover {
      background: #F9FAFB;
      border-color: #D1D5DB;
      color: #111827;
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
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .user-btn:hover {
      background: #F9FAFB;
      border-color: #D1D5DB;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #F3F4F6;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4B5563;
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
      color: #111827;
      line-height: 1.2;
    }

    .user-role {
      font-size: 12px;
      color: #6B7280;
      line-height: 1.2;
    }

    .dropdown-icon {
      font-size: 10px;
      color: #6B7280;
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
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: var(--border-radius-md);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
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
      color: #4B5563;
      font-size: 14px;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .dropdown-item:hover {
      background: #F9FAFB;
    }

    .dropdown-item:first-child {
      border-bottom: 1px solid #E5E7EB;
    }

    .menu-icon {
      width: 16px;
      height: 16px;
      stroke-width: 2;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .menu-toggle {
        display: inline-flex;
      }

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
export class AdminHeaderComponent implements OnInit, OnDestroy {
  @Output() menuToggle = new EventEmitter<void>();
  showUserMenu = false;
  showNotifications = false;
  unreadCount = 0;
  notifications: AdminNotification[] = [];
  notificationsLoading = false;
  canViewNotifications = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private profileSub: Subscription | null = null;
  private unreadSub: Subscription | null = null;
  private closeNotificationsHandler = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-menu')) {
      this.showNotifications = false;
    }
  };

  constructor(
    public auth: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.profileSub = this.auth.userProfile$.subscribe((profile) => {
      const canView =
        !!profile && ['admin', 'superadmin', 'subadmin'].includes(profile.role);
      if (canView && !this.canViewNotifications) {
        this.canViewNotifications = true;
        void this.notificationService.refreshUnreadCount();
        if (!this.unreadSub) {
          this.unreadSub = this.notificationService.unreadCount$.subscribe((c) => {
            this.unreadCount = c;
          });
        }
        if (!this.pollTimer) {
          this.pollTimer = setInterval(() => {
            this.notificationService.refreshUnreadCount();
          }, 60000);
        }
      } else if (!canView) {
        this.canViewNotifications = false;
        this.unreadCount = 0;
      }
    });

    this.notificationService.openPanel$.subscribe(() => {
      if (!this.canViewNotifications) return;
      this.showUserMenu = false;
      this.showNotifications = true;
      void this.loadNotificationList();
      setTimeout(() => {
        document.addEventListener('click', this.closeNotificationsHandler);
      }, 0);
    });
  }

  private async loadNotificationList(): Promise<void> {
    this.notificationsLoading = true;
    try {
      const res = await this.notificationService.listNotifications({ limit: 25 });
      this.notifications = res.notifications;
    } catch {
      this.notifications = [];
    } finally {
      this.notificationsLoading = false;
    }
  }

  ngOnDestroy() {
    this.profileSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
    if (this.pollTimer) clearInterval(this.pollTimer);
    document.removeEventListener('click', this.closeNotificationsHandler);
  }

  async toggleNotifications(event: Event) {
    event.stopPropagation();
    this.showUserMenu = false;
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      await this.loadNotificationList();
      setTimeout(() => {
        document.addEventListener('click', this.closeNotificationsHandler);
      }, 0);
    } else {
      document.removeEventListener('click', this.closeNotificationsHandler);
    }
  }

  async openNotification(n: AdminNotification) {
    if (!n.is_read) {
      await this.notificationService.markRead(n.id);
      n.is_read = true;
    }
    this.showNotifications = false;
    if (n.entity_type === 'booking') {
      this.router.navigate(['/admin/bookings']);
    } else if (n.entity_type === 'user') {
      this.router.navigate(['/admin/users']);
    } else {
      this.router.navigate(['/admin']);
    }
  }

  async markAllRead() {
    await this.notificationService.markAllRead();
    this.notifications = this.notifications.map((n) => ({ ...n, is_read: true }));
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

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

