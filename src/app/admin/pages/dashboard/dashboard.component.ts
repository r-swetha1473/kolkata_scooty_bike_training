import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { PermissionService } from '../../../services/permission.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <h1 class="admin-page-title">Dashboard Overview</h1>

      <section class="alert-section" *ngIf="stats?.expiredBookings > 0">
        <div class="alert-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <h2>Bookings requiring action</h2>
          <span class="alert-count">{{ stats.expiredBookings }} overdue</span>
        </div>
        <p class="alert-desc">These bookings have passed their slot time but are still pending or confirmed. Mark each as completed or cancelled.</p>
        <div class="overdue-list" *ngIf="stats?.overdueBookings?.length">
          <div class="overdue-item" *ngFor="let b of stats.overdueBookings">
            <div class="overdue-info">
              <strong>{{ b.customer_name || 'Customer' }}</strong>
              <span>{{ b.trainer_name || 'Trainer N/A' }}</span>
              <span class="overdue-time">{{ formatDateTime(b.end_time || b.start_time) }}</span>
              <span class="status-pill">{{ b.status }}</span>
            </div>
            <div class="overdue-actions" *ngIf="perms.can('bookings', 'edit')">
              <button class="btn-sm btn-complete" (click)="resolveBooking(b.id, 'completed')">Complete</button>
              <button class="btn-sm btn-cancel" (click)="resolveBooking(b.id, 'cancelled')">Cancel</button>
            </div>
          </div>
        </div>
        <a routerLink="/admin/bookings" class="alert-link">View all bookings →</a>
      </section>

      <div class="stats-grid" *ngIf="!loading">
        <div class="stat-card" *ngFor="let card of statCards" [class]="card.class || ''">
          <div class="stat-content">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </div>

      <p *ngIf="loading" class="loading-hint">Loading dashboard…</p>

      <div class="quick-actions" *ngIf="!loading">
        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-card" *ngIf="perms.canViewModule('slots')" (click)="navigateTo('/admin/slots')">
            <span class="action-label">Slots (automated)</span>
          </button>
          <button class="action-card" *ngIf="perms.canViewModule('bookings')" (click)="navigateTo('/admin/bookings')">
            <span class="action-label">Manage Bookings</span>
          </button>
          <button class="action-card" *ngIf="perms.canViewModule('trainers')" (click)="navigateTo('/admin/trainers')">
            <span class="action-label">Manage Trainers</span>
          </button>
          <button class="action-card" *ngIf="perms.canViewModule('vehicles')" (click)="navigateTo('/admin/vehicles')">
            <span class="action-label">Manage Vehicles</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1400px; }

    .loading-hint {
      color: var(--admin-text-secondary);
      padding: 16px 0;
    }

    .alert-section {
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 32px;
    }

    .alert-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      color: #92400E;
    }

    .alert-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      flex: 1;
    }

    .alert-count {
      background: #F59E0B;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
    }

    .alert-desc {
      margin: 0 0 16px;
      font-size: 14px;
      color: #78350F;
    }

    .overdue-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }

    .overdue-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .overdue-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #78350F;
    }

    .overdue-time { color: #92400E; }

    .status-pill {
      background: #FDE68A;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .overdue-actions { display: flex; gap: 8px; }

    .btn-sm {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-complete { background: #10B981; color: #fff; }
    .btn-cancel { background: #EF4444; color: #fff; }

    .alert-link {
      font-size: 13px;
      font-weight: 600;
      color: #92400E;
      text-decoration: none;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 48px;
    }

    .stat-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      transition: all 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      border-color: #0066B1;
    }

    .stat-card.warn { border-color: #FCD34D; background: #FFFBEB; }
    .stat-card.success { border-color: #A7F3D0; }

    .stat-icon {
      width: 24px;
      height: 24px;
      color: #6B7280;
      flex-shrink: 0;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }

    .stat-label {
      font-size: 13px;
      color: #6B7280;
      margin-top: 4px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 20px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .action-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }

    .action-card:hover {
      border-color: #0066B1;
      color: #0066B1;
    }

    .action-label { font-size: 14px; font-weight: 500; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .stat-value { font-size: 22px; }
      .overdue-item { flex-direction: column; align-items: flex-start; }
      .actions-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats: any = null;
  loading = true;
  statCards: { label: string; value: number; class?: string }[] = [];

  constructor(
    private adminService: AdminService,
    public perms: PermissionService,
    private router: Router,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadStats();
  }

  async loadStats() {
    this.loading = true;
    try {
      this.stats = await this.adminService.getDashboardStats();
      this.buildStatCards();
    } catch (err) {
      this.stats = {};
      this.buildStatCards();
      this.toastService.error(getApiErrorMessage(err, 'Failed to load dashboard statistics'));
    } finally {
      this.loading = false;
    }
  }

  buildStatCards() {
    const s = this.stats || {};
    const n = (v: unknown) => {
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    };
    this.statCards = [
      { label: "Today's Bookings", value: n(s.todayBookings) },
      { label: 'Pending Bookings', value: n(s.pendingBookings), class: 'warn' },
      { label: 'Completed Bookings', value: n(s.completedBookings), class: 'success' },
      { label: 'Cancelled Bookings', value: n(s.cancelledBookings) },
      { label: 'Expired Bookings', value: n(s.expiredBookings), class: 'warn' },
      { label: 'Active Trainers', value: n(s.activeTrainers ?? s.totalTrainers) },
      { label: 'Active Vehicles', value: n(s.activeVehicles) },
      { label: 'Total Customers', value: n(s.totalCustomers) }
    ];
  }

  navigateTo(route: string) {
    this.router.navigateByUrl(route);
  }

  formatDateTime(value: string): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  }

  async resolveBooking(id: string, status: string) {
    if (!confirm(`Mark this booking as ${status}?`)) return;
    try {
      await firstValueFrom(this.adminService.updateBookingStatus(id, status));
      await this.loadStats();
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to update booking'));
    }
  }
}
