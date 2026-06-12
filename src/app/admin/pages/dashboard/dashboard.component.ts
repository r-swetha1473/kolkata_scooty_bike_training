import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { PermissionService } from '../../../services/permission.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { firstValueFrom } from 'rxjs';
import {
  aggregateDailyBookings,
  aggregateStatusCounts,
  aggregateVehicleUsage,
  renderDonutChart,
  renderLineChart,
  renderStatusBarChart
} from '../../utils/dashboard-charts';

interface KpiCard {
  label: string;
  value: number | string;
  icon: string;
  tone: string;
  trend?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <div>
          <h1 class="admin-page-title">Dashboard Overview</h1>
          <p class="dashboard-subtitle">Operational insights and bookings requiring attention</p>
        </div>
        <button type="button" class="refresh-btn" (click)="loadStats()" [disabled]="loading">Refresh</button>
      </div>

      <section class="action-section" *ngIf="stats?.overdueBookings?.length">
        <div class="section-head">
          <div>
            <h2>Recent Booking Actions</h2>
            <p>{{ stats.expiredBookings || 0 }} overdue booking(s) need review</p>
          </div>
          <a routerLink="/admin/bookings" class="section-link">View all bookings →</a>
        </div>
        <div class="action-grid">
          <article class="action-card" *ngFor="let b of stats.overdueBookings">
            <div class="action-card-top">
              <strong>{{ b.customer_name || 'Customer' }}</strong>
              <span class="badge badge-pending">{{ b.status }}</span>
            </div>
            <div class="action-meta">
              <span>🕒 {{ formatDateTime(b.end_time || b.start_time) }}</span>
              <span class="badge badge-warn" *ngIf="!b.trainer_name">Unassigned Trainer</span>
              <span *ngIf="b.trainer_name">👤 {{ b.trainer_name }}</span>
            </div>
            <div class="action-card-actions">
              <button type="button" class="btn-outline" (click)="viewBookingDetails()">View Details</button>
              <ng-container *ngIf="perms.can('bookings', 'edit')">
                <button type="button" class="btn-success-sm" (click)="resolveBooking(b.id, 'completed')">Complete</button>
                <button type="button" class="btn-danger-sm" (click)="resolveBooking(b.id, 'cancelled')">Cancel</button>
              </ng-container>
            </div>
          </article>
        </div>
      </section>

      <div class="kpi-grid" *ngIf="!loading">
        <article class="kpi-card" *ngFor="let card of kpiCards" [class]="'tone-' + card.tone">
          <div class="kpi-icon">{{ card.icon }}</div>
          <div class="kpi-body">
            <div class="kpi-value">{{ card.value }}</div>
            <div class="kpi-label">{{ card.label }}</div>
            <div class="kpi-trend" *ngIf="card.trend">{{ card.trend }}</div>
          </div>
        </article>
      </div>
      <p *ngIf="loading" class="loading-hint">Loading dashboard…</p>

      <div class="charts-grid" *ngIf="!loading && chartsReady">
        <section class="chart-card chart-wide">
          <h3>Bookings Trend (30 days)</h3>
          <div #lineChartHost class="chart-host"></div>
        </section>
        <section class="chart-card">
          <h3>Vehicle Usage</h3>
          <div #donutChartHost class="chart-host chart-host-donut"></div>
        </section>
        <section class="chart-card chart-wide">
          <h3>Booking Status</h3>
          <div #statusChartHost class="chart-host"></div>
        </section>
      </div>

      <div class="quick-actions" *ngIf="!loading">
        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-tile" *ngIf="perms.canViewModule('bookings')" (click)="navigateTo('/admin/bookings')">Manage Bookings</button>
          <button class="action-tile" *ngIf="perms.canViewModule('slots')" (click)="navigateTo('/admin/slots')">Slots (automated)</button>
          <button class="action-tile" *ngIf="perms.canViewModule('trainers')" (click)="navigateTo('/admin/trainers')">Manage Trainers</button>
          <button class="action-tile" *ngIf="perms.canViewModule('vehicles')" (click)="navigateTo('/admin/vehicles')">Manage Vehicles</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard { max-width: 1400px; }
      .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 24px;
      }
      .dashboard-subtitle { margin: 6px 0 0; color: var(--admin-text-secondary); font-size: 14px; }
      .refresh-btn {
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid var(--admin-border);
        background: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .loading-hint { color: var(--admin-text-secondary); padding: 16px 0; }
      .action-section {
        background: linear-gradient(135deg, #fffbeb, #fef3c7);
        border: 1px solid #fde68a;
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 28px;
        box-shadow: var(--admin-shadow-sm);
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .section-head h2 { margin: 0; font-size: 18px; color: #92400e; }
      .section-head p { margin: 4px 0 0; color: #b45309; font-size: 13px; }
      .section-link { color: #92400e; font-weight: 600; text-decoration: none; font-size: 13px; }
      .action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 14px;
      }
      .action-card {
        background: #fff;
        border: 1px solid #fde68a;
        border-radius: 12px;
        padding: 14px;
        box-shadow: var(--admin-shadow-sm);
      }
      .action-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .action-meta {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        color: #78350f;
        margin-bottom: 12px;
      }
      .action-card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .btn-outline, .btn-success-sm, .btn-danger-sm {
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid;
      }
      .btn-outline { background: #fff; border-color: #d1d5db; color: #374151; }
      .btn-success-sm { background: #10b981; border-color: #10b981; color: #fff; }
      .btn-danger-sm { background: #ef4444; border-color: #ef4444; color: #fff; }
      .badge {
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .badge-pending { background: #fef3c7; color: #92400e; }
      .badge-warn { background: #fee2e2; color: #991b1b; }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 16px;
        margin-bottom: 28px;
      }
      .kpi-card {
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 14px;
        padding: 18px;
        display: flex;
        gap: 14px;
        align-items: flex-start;
        box-shadow: var(--admin-shadow-sm);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--admin-shadow-hover);
      }
      .kpi-icon {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        background: var(--admin-primary-light);
      }
      .tone-warn .kpi-icon { background: #fef3c7; }
      .tone-success .kpi-icon { background: #d1fae5; }
      .tone-purple .kpi-icon { background: #ede9fe; }
      .kpi-value { font-size: 28px; font-weight: 700; line-height: 1; color: #111827; }
      .kpi-label { margin-top: 6px; font-size: 13px; color: #6b7280; }
      .kpi-trend { margin-top: 4px; font-size: 12px; color: #10b981; font-weight: 600; }
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 28px;
      }
      .chart-card {
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 14px;
        padding: 16px;
        box-shadow: var(--admin-shadow-sm);
      }
      .chart-card h3 { margin: 0 0 12px; font-size: 15px; color: #111827; }
      .chart-wide { grid-column: span 2; }
      .chart-host { width: 100%; min-height: 260px; }
      .chart-host-donut ::ng-deep .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 8px;
        font-size: 12px;
        color: #4b5563;
      }
      .chart-host-donut ::ng-deep .legend-item { display: flex; align-items: center; gap: 6px; }
      .chart-host-donut ::ng-deep .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
      }
      .section-title { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }
      .action-tile {
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 10px;
        padding: 16px;
        cursor: pointer;
        text-align: left;
        font-weight: 600;
        transition: all 0.2s;
      }
      .action-tile:hover { border-color: var(--admin-primary); color: var(--admin-primary); }
      @media (max-width: 900px) {
        .charts-grid { grid-template-columns: 1fr; }
        .chart-wide { grid-column: span 1; }
        .dashboard-header { flex-direction: column; }
      }
      @media (max-width: 768px) {
        .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        .action-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 480px) {
        .kpi-grid { grid-template-columns: 1fr; }
      }
    `
  ]
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('lineChartHost') lineChartHost?: ElementRef<HTMLElement>;
  @ViewChild('donutChartHost') donutChartHost?: ElementRef<HTMLElement>;
  @ViewChild('statusChartHost') statusChartHost?: ElementRef<HTMLElement>;

  stats: any = null;
  loading = true;
  chartsReady = false;
  kpiCards: KpiCard[] = [];
  private chartBookings: any[] = [];
  private resizeHandler = () => this.renderCharts();

  constructor(
    private adminService: AdminService,
    public perms: PermissionService,
    private router: Router,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  async ngOnInit() {
    await this.loadStats();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderCharts(), 0);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeHandler);
  }

  async loadStats() {
    this.loading = true;
    try {
      this.stats = await this.adminService.getDashboardStats();
      this.buildKpiCards();
      await this.loadChartBookings();
      this.chartsReady = true;
      setTimeout(() => this.renderCharts(), 0);
    } catch (err) {
      this.stats = {};
      this.buildKpiCards();
      this.toastService.error(getApiErrorMessage(err, 'Failed to load dashboard statistics'));
    } finally {
      this.loading = false;
    }
  }

  private async loadChartBookings() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const pages = await Promise.all([
        this.adminService.getAllBookings({
          startDate: fmt(start),
          endDate: fmt(end),
          limit: 200,
          offset: 0
        }),
        this.adminService.getAllBookings({
          startDate: fmt(start),
          endDate: fmt(end),
          limit: 200,
          offset: 200
        })
      ]);
      this.chartBookings = [...pages[0].bookings, ...pages[1].bookings];
    } catch {
      this.chartBookings = [];
    }
  }

  private renderCharts() {
    if (!this.chartsReady) return;
    const lineEl = this.lineChartHost?.nativeElement;
    const donutEl = this.donutChartHost?.nativeElement;
    const statusEl = this.statusChartHost?.nativeElement;
    if (lineEl) {
      renderLineChart(lineEl, aggregateDailyBookings(this.chartBookings, 30));
    }
    if (donutEl) {
      renderDonutChart(donutEl, aggregateVehicleUsage(this.chartBookings));
    }
    if (statusEl) {
      renderStatusBarChart(statusEl, aggregateStatusCounts(this.chartBookings));
    }
  }

  buildKpiCards() {
    const s = this.stats || {};
    const n = (v: unknown) => {
      const num = Number(v);
      return Number.isFinite(num) ? num : 0;
    };
    this.kpiCards = [
      { label: 'Total Users', value: n(s.totalUsers), icon: '👥', tone: 'default', trend: 'All profiles' },
      { label: 'Active Trainers', value: n(s.activeTrainers ?? s.totalTrainers), icon: '✓', tone: 'success' },
      { label: 'Active Vehicles', value: n(s.activeVehicles), icon: '🚗', tone: 'default' },
      { label: "Today's Bookings", value: n(s.todayBookings), icon: '📅', tone: 'purple', trend: 'Live today' },
      { label: 'Pending Bookings', value: n(s.pendingBookings), icon: '⏳', tone: 'warn' },
      { label: 'Revenue', value: 'N/A', icon: '₹', tone: 'default', trend: 'Not configured' }
    ];
  }

  navigateTo(route: string) {
    this.router.navigateByUrl(route);
  }

  viewBookingDetails() {
    this.router.navigate(['/admin/bookings']);
  }

  formatDateTime(value: string): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  }

  async resolveBooking(id: string, status: string) {
    const ok = await this.confirmDialog.confirm({
      title: 'Update booking',
      message: `Mark this booking as ${status}?`,
      confirmLabel: 'Yes, update',
      variant: status === 'cancelled' ? 'danger' : 'warning'
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.adminService.updateBookingStatus(id, status));
      await this.loadStats();
      this.toastService.success(`Booking marked as ${status}`);
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to update booking'));
    }
  }
}
