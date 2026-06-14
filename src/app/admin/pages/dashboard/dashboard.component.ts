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
  aggregateSourceCounts,
  aggregateAttendanceCounts,
  aggregateMonthlyAttendanceTrend,
  aggregateStatusCounts,
  aggregateVehicleUsage,
  ChartCleanup,
  renderAttendanceTrendChart,
  renderDonutChart,
  renderLabelBarChart,
  renderLineChart,
  renderStatusBarChart
} from '../../utils/dashboard-charts';
import { ChartTooltip } from '../../utils/chart-tooltip';

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

      <div class="capacity-alert over-capacity-alert" *ngIf="(stats?.capacityExceededSlots || 0) > 0">
        <span class="over-capacity-badge">OVER CAPACITY</span>
        {{ stats.capacityExceededSlots }} slot(s) have current bookings exceeding active vehicle capacity. Existing bookings are preserved; no new bookings should be added until resolved.
      </div>

      <section class="ops-section" *ngIf="!loading">
        <h2 class="section-title">Today's Operations</h2>
        <div class="ops-grid">
          <article class="ops-card"><span class="ops-value">{{ n(stats?.todayOperations?.todayBookings) }}</span><span class="ops-label">Today's Bookings</span></article>
          <article class="ops-card"><span class="ops-value">{{ n(stats?.todayOperations?.todayOfflineBookings) }}</span><span class="ops-label">Today's Offline</span></article>
          <article class="ops-card"><span class="ops-value">{{ n(stats?.todayOperations?.todayOnlineBookings) }}</span><span class="ops-label">Today's Online</span></article>
          <article class="ops-card tone-success"><span class="ops-value">{{ n(stats?.todayOperations?.todayAttended) }}</span><span class="ops-label">Today's Attended</span></article>
          <article class="ops-card tone-warn"><span class="ops-value">{{ n(stats?.todayOperations?.todayPending) }}</span><span class="ops-label">Today's Pending</span></article>
          <article class="ops-card tone-danger"><span class="ops-value">{{ n(stats?.todayOperations?.todayNoShows) }}</span><span class="ops-label">Today's No Shows</span></article>
        </div>
      </section>

      <section class="health-section" *ngIf="!loading">
        <h2 class="section-title">System Health</h2>
        <div class="health-grid">
          <div><strong>{{ n(stats?.systemHealth?.activeVehicles) }}</strong><span>Active Vehicles</span></div>
          <div><strong>{{ n(stats?.systemHealth?.activeTrainers) }}</strong><span>Active Trainers</span></div>
          <div><strong>{{ n(stats?.systemHealth?.futureSlots) }}</strong><span>Future Slots</span></div>
          <div><strong>{{ n(stats?.systemHealth?.pendingReactivationRequests) }}</strong><span>Pending Reactivation</span></div>
          <div><strong>{{ n(stats?.systemHealth?.offlineBookingsToday) }}</strong><span>Offline Today</span></div>
          <div><strong>{{ n(stats?.systemHealth?.capacityWarnings) }}</strong><span>Capacity Warnings</span></div>
          <div class="health-version"><strong>{{ stats?.systemHealth?.deploymentVersion || '—' }}</strong><span>Deployment Version</span></div>
        </div>
      </section>

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
              <button type="button" class="btn-outline" (click)="viewBookingDetails(b)">View Details</button>
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

      <section class="util-section" *ngIf="!loading && stats?.slotUtilization?.length">
        <h2 class="section-title">Peak Slot Utilization</h2>
        <div class="util-list">
          <article class="util-row" *ngFor="let slot of stats.slotUtilization">
            <div>
              <strong>{{ formatDateTime(slot.start_time) }}</strong>
              <span class="util-label">{{ slot.utilization_label }}</span>
            </div>
            <span class="over-capacity-badge" *ngIf="slot.capacity_exceeded">OVER CAPACITY</span>
          </article>
        </div>
      </section>

      <div class="charts-grid" *ngIf="!loading && chartsReady">
        <section class="chart-card chart-wide">
          <h3>Bookings Trend (30 days)</h3>
          <div #lineChartHost class="chart-host"></div>
        </section>
        <section class="chart-card">
          <h3>Vehicle Usage</h3>
          <div #donutChartHost class="chart-host chart-host-donut"></div>
        </section>
        <section class="chart-card">
          <h3>Online vs Offline</h3>
          <div #sourceChartHost class="chart-host chart-host-donut"></div>
        </section>
        <section class="chart-card">
          <h3>Attendance Status</h3>
          <div #attendanceChartHost class="chart-host chart-host-donut"></div>
        </section>
        <section class="chart-card chart-wide">
          <h3>Monthly Attendance Trend</h3>
          <div #attendanceTrendHost class="chart-host"></div>
        </section>
        <section class="chart-card chart-wide">
          <h3>Booking Status</h3>
          <div #statusChartHost class="chart-host"></div>
        </section>
      </div>

      <section class="analytics-section" *ngIf="!loading">
        <h2 class="section-title">Vehicle Analytics</h2>
        <div class="analytics-table-wrap" *ngIf="stats?.vehicleAnalytics?.length; else noVehicleAnalytics">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Total Bookings</th>
                <th>Attendance %</th>
                <th>No Shows</th>
                <th>Usage %</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of stats.vehicleAnalytics">
                <td>{{ row.vehicle_name }}</td>
                <td>{{ row.total_bookings }}</td>
                <td>{{ row.attendance_percent }}%</td>
                <td>{{ row.no_shows }}</td>
                <td>{{ row.usage_percent }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noVehicleAnalytics><p class="empty-analytics">No vehicle analytics yet.</p></ng-template>
        <div class="charts-grid analytics-charts" *ngIf="chartsReady">
          <section class="chart-card">
            <h3>Top Used Vehicle</h3>
            <div #topVehicleChartHost class="chart-host"></div>
          </section>
          <section class="chart-card">
            <h3>Least Used Vehicle</h3>
            <div #leastVehicleChartHost class="chart-host"></div>
          </section>
        </div>
      </section>

      <section class="analytics-section" *ngIf="!loading">
        <h2 class="section-title">Trainer Analytics</h2>
        <div class="analytics-table-wrap" *ngIf="stats?.trainerAnalytics?.length; else noTrainerAnalytics">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Assigned Bookings</th>
                <th>Completed Sessions</th>
                <th>Attendance %</th>
                <th>No Show %</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of stats.trainerAnalytics">
                <td>{{ row.trainer_name }}</td>
                <td>{{ row.assigned_bookings }}</td>
                <td>{{ row.completed_sessions }}</td>
                <td>{{ row.attendance_percent }}%</td>
                <td>{{ row.no_show_percent }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noTrainerAnalytics><p class="empty-analytics">No trainer analytics yet.</p></ng-template>
        <div class="charts-grid analytics-charts" *ngIf="chartsReady">
          <section class="chart-card">
            <h3>Trainer Workload</h3>
            <div #trainerWorkloadChartHost class="chart-host"></div>
          </section>
          <section class="chart-card">
            <h3>Trainer Assignment Trend</h3>
            <div #trainerTrendChartHost class="chart-host"></div>
          </section>
        </div>
      </section>

      <section class="activity-section" *ngIf="!loading && stats?.recentAdminActivity?.length">
        <h2 class="section-title">Recent Admin Activity</h2>
        <div class="activity-table-wrap">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Admin Name</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of stats.recentAdminActivity">
                <td>{{ row.admin_name }}</td>
                <td>{{ formatDateTime(row.date) }}</td>
                <td>{{ row.action }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="quick-actions" *ngIf="!loading">
        <h2 class="section-title">Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-tile" *ngIf="perms.can('bookings', 'create')" (click)="navigateTo('/admin/offline-bookings')">Create Offline Booking</button>
          <button class="action-tile" *ngIf="perms.can('bookings', 'create')" (click)="navigateTo('/admin/offline-bookings')">Create Walk-in Customer</button>
          <button class="action-tile" *ngIf="perms.canViewModule('bookings')" (click)="navigateTo('/admin/bookings')">Assign Trainer</button>
          <button class="action-tile" *ngIf="perms.canViewModule('slots')" (click)="viewTodaySchedule()">View Today's Schedule</button>
          <button class="action-tile" *ngIf="perms.canViewModule('bookings')" (click)="exportTodayBookings()">Export Today's Bookings</button>
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
      .capacity-alert {
        margin-bottom: 16px;
        padding: 12px 16px;
        border-radius: 10px;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
        font-size: 14px;
      }
      .over-capacity-alert {
        background: #fef2f2;
        color: #991b1b;
        border-color: #fecaca;
      }
      .over-capacity-badge {
        display: inline-block;
        margin-right: 8px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.05em;
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
      }
      .ops-section, .health-section, .util-section, .analytics-section, .activity-section {
        margin-bottom: 28px;
      }
      .ops-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      .ops-card {
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: var(--admin-shadow-sm);
      }
      .ops-card.tone-success { border-color: #bbf7d0; background: #f0fdf4; }
      .ops-card.tone-warn { border-color: #fde68a; background: #fffbeb; }
      .ops-card.tone-danger { border-color: #fecaca; background: #fef2f2; }
      .ops-value { font-size: 24px; font-weight: 700; color: #111827; }
      .ops-label { font-size: 12px; color: #6b7280; font-weight: 600; }
      .health-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 14px;
        padding: 16px;
      }
      .health-grid div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .health-grid strong { font-size: 20px; color: #111827; }
      .health-grid span { font-size: 12px; color: #6b7280; }
      .health-version { grid-column: span 2; }
      .util-list { display: flex; flex-direction: column; gap: 8px; }
      .util-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 10px;
        padding: 12px 14px;
      }
      .util-label { display: block; font-size: 12px; color: #6b7280; margin-top: 2px; }
      .analytics-table-wrap, .activity-table-wrap {
        overflow-x: auto;
        margin-bottom: 16px;
        background: #fff;
        border: 1px solid var(--admin-border);
        border-radius: 12px;
      }
      .analytics-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .analytics-table th, .analytics-table td {
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid #f3f4f6;
      }
      .analytics-table th {
        background: #f9fafb;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6b7280;
      }
      .analytics-charts { margin-top: 8px; }
      .empty-analytics { color: #6b7280; font-size: 13px; margin: 0 0 12px; }
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
        transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
      }
      .chart-card:hover {
        box-shadow: var(--admin-shadow-lg);
        transform: translateY(-2px);
        border-color: var(--admin-border-hover);
      }
      .chart-card h3 { margin: 0 0 12px; font-size: 15px; color: var(--admin-text); }
      .chart-wide { grid-column: span 2; }
      .chart-host { width: 100%; min-height: 260px; }
      .chart-host-donut ::ng-deep .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 8px;
        font-size: 12px;
        color: var(--chart-axis);
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
  @ViewChild('sourceChartHost') sourceChartHost?: ElementRef<HTMLElement>;
  @ViewChild('attendanceChartHost') attendanceChartHost?: ElementRef<HTMLElement>;
  @ViewChild('attendanceTrendHost') attendanceTrendHost?: ElementRef<HTMLElement>;
  @ViewChild('statusChartHost') statusChartHost?: ElementRef<HTMLElement>;
  @ViewChild('topVehicleChartHost') topVehicleChartHost?: ElementRef<HTMLElement>;
  @ViewChild('leastVehicleChartHost') leastVehicleChartHost?: ElementRef<HTMLElement>;
  @ViewChild('trainerWorkloadChartHost') trainerWorkloadChartHost?: ElementRef<HTMLElement>;
  @ViewChild('trainerTrendChartHost') trainerTrendChartHost?: ElementRef<HTMLElement>;

  stats: any = null;
  loading = true;
  chartsReady = false;
  kpiCards: KpiCard[] = [];
  private chartBookings: any[] = [];
  private chartCleanups: ChartCleanup[] = [];
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
    this.destroyCharts();
    ChartTooltip.destroyInstance();
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

  private destroyCharts() {
    this.chartCleanups.forEach((cleanup) => cleanup());
    this.chartCleanups = [];
  }

  private renderCharts() {
    if (!this.chartsReady) return;
    this.destroyCharts();

    const lineEl = this.lineChartHost?.nativeElement;
    const donutEl = this.donutChartHost?.nativeElement;
    const sourceEl = this.sourceChartHost?.nativeElement;
    const attendanceEl = this.attendanceChartHost?.nativeElement;
    const attendanceTrendEl = this.attendanceTrendHost?.nativeElement;
    const statusEl = this.statusChartHost?.nativeElement;
    if (lineEl) {
      this.chartCleanups.push(
        renderLineChart(lineEl, aggregateDailyBookings(this.chartBookings, 30))
      );
    }
    if (donutEl) {
      this.chartCleanups.push(renderDonutChart(donutEl, aggregateVehicleUsage(this.chartBookings)));
    }
    if (sourceEl) {
      this.chartCleanups.push(renderDonutChart(sourceEl, aggregateSourceCounts(this.chartBookings)));
    }
    if (attendanceEl) {
      this.chartCleanups.push(renderDonutChart(attendanceEl, aggregateAttendanceCounts(this.chartBookings)));
    }
    if (attendanceTrendEl) {
      this.chartCleanups.push(
        renderAttendanceTrendChart(attendanceTrendEl, aggregateMonthlyAttendanceTrend(this.chartBookings))
      );
    }
    if (statusEl) {
      this.chartCleanups.push(
        renderStatusBarChart(statusEl, aggregateStatusCounts(this.chartBookings))
      );
    }

    const topVehicleEl = this.topVehicleChartHost?.nativeElement;
    const leastVehicleEl = this.leastVehicleChartHost?.nativeElement;
    const trainerWorkloadEl = this.trainerWorkloadChartHost?.nativeElement;
    const trainerTrendEl = this.trainerTrendChartHost?.nativeElement;

    if (topVehicleEl) {
      this.chartCleanups.push(
        renderLabelBarChart(topVehicleEl, this.stats?.vehicleCharts?.topUsed || [], '#0066B1')
      );
    }
    if (leastVehicleEl) {
      this.chartCleanups.push(
        renderLabelBarChart(leastVehicleEl, this.stats?.vehicleCharts?.leastUsed || [], '#6B7280')
      );
    }
    if (trainerWorkloadEl) {
      this.chartCleanups.push(
        renderLabelBarChart(trainerWorkloadEl, this.stats?.trainerCharts?.workload || [], '#10B981')
      );
    }
    if (trainerTrendEl) {
      const trend = (this.stats?.trainerCharts?.assignmentTrend || []).map(
        (row: { label: string; value: number }) => ({ date: row.label, count: row.value })
      );
      this.chartCleanups.push(renderLineChart(trainerTrendEl, trend));
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
      { label: "Today's Online", value: n(s.todayOnlineBookings), icon: '🌐', tone: 'success', trend: 'Customer bookings' },
      { label: "Today's Offline", value: n(s.todayOfflineBookings), icon: '🏪', tone: 'purple', trend: 'Walk-in bookings' },
      { label: 'Total Attended', value: n(s.totalAttended), icon: '✓', tone: 'success' },
      { label: 'Total No Shows', value: n(s.totalNoShows), icon: '✗', tone: 'warn' },
      { label: 'Attendance Rate', value: `${n(s.attendanceRate)}%`, icon: '📊', tone: 'default', trend: 'Attended vs no-show' },
      { label: 'Pending Bookings', value: n(s.pendingBookings), icon: '⏳', tone: 'warn' }
    ];
  }

  navigateTo(route: string) {
    this.router.navigateByUrl(route);
  }

  viewTodaySchedule() {
    const today = new Date().toISOString().slice(0, 10);
    this.router.navigate(['/admin/slots'], { queryParams: { date: today } });
  }

  async exportTodayBookings() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const blob = await this.adminService.exportBookings({ startDate: today, endDate: today });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookings_today_${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      this.toastService.success("Today's bookings exported");
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Export failed'));
    }
  }

  n(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  viewBookingDetails(booking?: { id?: string }) {
    if (booking?.id) {
      this.router.navigate(['/admin/bookings'], { queryParams: { details: booking.id } });
      return;
    }
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
