import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h1 class="page-title">Dashboard Overview</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.totalBookings || 0 }}</div>
            <div class="stat-label">Total Bookings</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.activeSlots || 0 }}</div>
            <div class="stat-label">Active Slots</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">👨‍🏫</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.totalTrainers || 0 }}</div>
            <div class="stat-label">Active Trainers</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.todaySessions || 0 }}</div>
            <div class="stat-label">Today's Sessions</div>
          </div>
        </div>

        <div class="stat-card highlight">
          <div class="stat-icon">🔔</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.pendingBookings || 0 }}</div>
            <div class="stat-label">Pending Bookings</div>
          </div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">✅</div>
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
            <span class="action-icon">➕</span>
            <span class="action-label">Create New Slot</span>
          </button>
          <button class="action-card" (click)="navigateTo('/admin/bookings')">
            <span class="action-icon">📋</span>
            <span class="action-label">Manage Bookings</span>
          </button>
          <button class="action-card" (click)="navigateTo('/admin/trainers')">
            <span class="action-icon">👥</span>
            <span class="action-label">Manage Trainers</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1400px;
    }

    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 32px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .stat-card.highlight {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }

    .stat-card.success {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    }

    .stat-icon {
      font-size: 40px;
    }

    .stat-content {
      flex: 1;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #1f2937;
      line-height: 1;
    }

    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 20px 0;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .action-card {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-card:hover {
      border-color: #667eea;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      transform: translateY(-2px);
    }

    .action-icon {
      font-size: 32px;
    }

    .action-label {
      font-size: 14px;
      font-weight: 600;
      text-align: center;
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
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  navigateTo(route: string) {
    window.location.href = route;
  }
}
