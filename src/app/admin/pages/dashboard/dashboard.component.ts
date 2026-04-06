import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h1 class="admin-page-title">Dashboard Overview</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.totalBookings || 0 }}</div>
            <div class="stat-label">Total Bookings</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.activeSlots || 0 }}</div>
            <div class="stat-label">Active Slots</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.totalTrainers || 0 }}</div>
            <div class="stat-label">Active Trainers</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.todaySessions || 0 }}</div>
            <div class="stat-label">Today's Sessions</div>
          </div>
        </div>

        <div class="stat-card highlight">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.pendingBookings || 0 }}</div>
            <div class="stat-label">Pending Bookings</div>
          </div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.completedToday || 0 }}</div>
            <div class="stat-label">Completed Today</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-card" (click)="navigateTo('/admin/slots')">
            <svg class="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="action-label">Slots (automated)</span>
          </button>
          <button class="action-card" (click)="navigateTo('/admin/bookings')">
            <svg class="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="action-label">Manage Bookings</span>
          </button>
          <button class="action-card" (click)="navigateTo('/admin/trainers')">
            <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="action-label">Manage Trainers</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1400px;
      background: var(--background-color);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 56px;
    }

    .stat-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      border-color: #0066B1;
    }

    .stat-card.highlight {
      background: #FFFFFF;
      border-color: #E5E7EB;
    }

    .stat-card.success {
      background: #FFFFFF;
      border-color: #E5E7EB;
    }

    .stat-icon {
      width: 24px;
      height: 24px;
      opacity: 0.6;
      color: #6B7280;
      flex-shrink: 0;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }

    .stat-label {
      font-size: 14px;
      color: #6B7280;
      margin-top: 4px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 24px 0;
    }

    .quick-actions {
      margin-top: 48px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      background: #F9FAFB;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #E5E7EB;
    }

    .action-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
    }

    .action-card:hover {
      border-color: #0066B1;
      background: #FFFFFF;
      color: #0066B1;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 102, 177, 0.15);
    }

    .action-icon {
      width: 20px;
      height: 20px;
      opacity: 0.7;
      color: #6B7280;
      flex-shrink: 0;
    }

    .action-card:hover .action-icon {
      color: #0066B1;
      opacity: 1;
    }

    .action-label {
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      color: #111827;
    }

    .action-card:hover .action-label {
      color: #0066B1;
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .actions-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats: any = null;

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadStats();
  }

  async loadStats() {
    try {
      this.stats = await this.adminService.getDashboardStats();
    } catch {
      /* stats optional */
    }
  }

  navigateTo(route: string) {
    window.location.href = route;
  }
}
