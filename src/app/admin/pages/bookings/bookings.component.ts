import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { firstValueFrom } from 'rxjs';
import { categorizeVehicleName } from '../../../utils/vehicle.utils';
import { PermissionService } from '../../../services/permission.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bookings-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Manage Bookings</h1>
      </div>

      <div class="admin-filters-bar">
        <div class="admin-filters-content">
          <div class="admin-filter-group admin-search-group">
            <svg class="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="search"
              [ngModel]="searchTerm"
              (ngModelChange)="onSearchChange($event)"
              (keyup.enter)="applySearch()"
              placeholder="Search customer, trainer, phone, vehicle, booking ID..." 
              class="admin-search-input"
              aria-label="Search bookings">
          </div>

          <select [(ngModel)]="statusFilter" (change)="onServerFiltersChange()" class="admin-select">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div class="admin-filter-group">
            <select [(ngModel)]="datePreset" (change)="onDatePresetChange()" class="admin-select">
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="thisMonth">This month</option>
              <option value="custom">Custom</option>
            </select>
            <div class="date-inputs" *ngIf="datePreset === 'custom'">
              <input
                type="date"
                [(ngModel)]="startDateFilter"
                (change)="onServerFiltersChange()"
                class="admin-select date-input">
              <span class="date-separator">–</span>
              <input
                type="date"
                [(ngModel)]="endDateFilter"
                (change)="onServerFiltersChange()"
                class="admin-select date-input">
            </div>
          </div>

          <button class="admin-btn admin-btn-secondary" (click)="resetFilters()" title="Reset filters">
            <svg class="admin-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <polyline points="23 20 23 14 17 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            Reset
          </button>

          <button class="admin-btn admin-btn-secondary" (click)="loadBookings()" title="Refresh data">
            <svg class="admin-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="admin-table-container bookings-table-wrap">
        <p *ngIf="loadingList" class="loading-hint">Loading…</p>
        <table class="admin-data-table bookings-table" *ngIf="!loadingList">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Slot Time</th>
              <th>Vehicle</th>
              <th>Trainer</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let booking of bookings">
              <td>
                <div class="customer-info">
                  <div class="name">{{ booking.user?.full_name || booking.user_name || 'N/A' }}</div>
                  <div class="email">{{ booking.user?.email || booking.user_email || '' }}</div>
                </div>
              </td>
              <td>{{ booking.formatted_slot_time || (booking.slot?.start_time ? formatDateTime(booking.slot.start_time) : (booking.start_time ? formatDateTime(booking.start_time) : 'N/A')) }}</td>
              <td><span class="vehicle-pill">{{ getVehicleLabel(booking) }}</span></td>
              <td>
                <span class="trainer-pill" [class.unassigned]="!getTrainerName(booking)">
                  {{ getTrainerName(booking) || 'Unassigned' }}
                </span>
              </td>
              <td>
                <span class="status-badge" [class]="'status-' + booking.status">
                  {{ booking.status }}
                </span>
              </td>
              <td>{{ formatDate(booking.created_at) }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    *ngIf="perms.can('bookings', 'edit') && !getTrainerName(booking)"
                    class="btn-action btn-assign"
                    (click)="openAssignTrainer(booking)"
                    title="Assign trainer"
                    aria-label="Assign trainer">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                    </svg>
                  </button>
                  <button
                    *ngIf="booking.status === 'pending'"
                    class="btn-action btn-confirm"
                    (click)="updateStatus(booking.id, 'confirmed')"
                    title="Confirm booking"
                    aria-label="Confirm booking">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </button>
                  <button
                    *ngIf="booking.status === 'confirmed'"
                    class="btn-action btn-complete"
                    (click)="updateStatus(booking.id, 'completed')"
                    title="Mark completed"
                    aria-label="Mark completed">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                  <button
                    *ngIf="['pending', 'confirmed'].includes(booking.status)"
                    class="btn-action btn-cancel"
                    (click)="updateStatus(booking.id, 'cancelled')"
                    title="Cancel booking"
                    aria-label="Cancel booking">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-action btn-delete"
                    (click)="deleteBooking(booking.id)"
                    title="Delete booking"
                    aria-label="Delete booking">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="bookings.length === 0 && !loadingList" class="empty-state">
          <p>No bookings found</p>
        </div>
      </div>

      <div class="admin-pagination" *ngIf="totalRecords > 0">
        <div class="admin-pagination-info">
          <span class="admin-pagination-count">Showing {{ getStartIndex() }}–{{ getEndIndex() }} of {{ totalRecords }} bookings</span>
          <select [(ngModel)]="itemsPerPage" (ngModelChange)="onPageSizeChange()" class="admin-page-size-select">
            <option [value]="10">10</option>
            <option [value]="20">20</option>
            <option [value]="50">50</option>
            <option [value]="100">100</option>
          </select>
        </div>
        <div class="admin-pagination-controls" *ngIf="totalPages > 1">
          <button 
            class="admin-pagination-btn" 
            [disabled]="currentPage === 1"
            (click)="goToPage(currentPage - 1)"
            title="Previous page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <ng-container *ngFor="let page of getPageNumbers()">
            <button
              *ngIf="typeof page === 'number'"
              class="admin-pagination-btn"
              [class.active]="page === currentPage"
              (click)="goToPage(page)"
              [title]="'Go to page ' + page">
              {{ page }}
            </button>
            <span *ngIf="page === '...'" class="admin-page-ellipsis">...</span>
          </ng-container>
          <button 
            class="admin-pagination-btn" 
            [disabled]="currentPage === totalPages"
            (click)="goToPage(currentPage + 1)"
            title="Next page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="assignModalOpen" (click)="closeAssignTrainer()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <h2>Assign Trainer</h2>
          <div class="modal-field">
            <label>Customer Name</label>
            <input type="text" [value]="assignForm.customerName" readonly />
          </div>
          <div class="modal-field">
            <label>Slot Time</label>
            <input type="text" [value]="assignForm.slotTime" readonly />
          </div>
          <div class="modal-field">
            <label>Vehicle</label>
            <input type="text" [value]="assignForm.vehicle" readonly />
          </div>
          <div class="modal-field">
            <label for="trainerSelect">Trainer</label>
            <select id="trainerSelect" [(ngModel)]="assignForm.trainerId" class="admin-select full-width">
              <option value="">Select trainer</option>
              <option *ngFor="let t of trainers" [value]="t.id">
                {{ t.profile?.full_name || t.full_name || 'Trainer' }}
              </option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="admin-btn admin-btn-secondary" (click)="closeAssignTrainer()">Cancel</button>
            <button type="button" class="admin-btn admin-btn-primary" (click)="saveTrainerAssignment()" [disabled]="assignSaving || !assignForm.trainerId">
              {{ assignSaving ? 'Saving…' : 'Save Assignment' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bookings-page {
      max-width: 1400px;
    }

    .bookings-table-wrap {
      border-radius: 12px;
      box-shadow: var(--admin-shadow-md);
      border: 1px solid var(--admin-border);
      background: #fff;
    }

    .bookings-table thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f9fafb;
      box-shadow: inset 0 -1px 0 var(--admin-border);
    }

    .vehicle-pill, .trainer-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .trainer-pill.unassigned {
      background: #fef3c7;
      color: #92400e;
    }

    .btn-assign {
      border-color: #8b5cf6;
      color: #7c3aed;
    }

    .btn-assign:hover {
      background: #7c3aed;
      color: #fff;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(17, 24, 39, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9000;
      padding: 16px;
    }

    .modal-card {
      background: #fff;
      border-radius: 14px;
      padding: 22px;
      width: min(460px, 100%);
      box-shadow: var(--admin-shadow-hover);
    }

    .modal-card h2 { margin: 0 0 16px; font-size: 20px; }
    .modal-field { margin-bottom: 12px; }
    .modal-field label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--admin-text-secondary);
    }
    .modal-field input, .full-width { width: 100%; }
    .modal-field input {
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      background: #f9fafb;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }

    .loading-hint {
      padding: 12px 0;
      color: var(--admin-text-secondary);
      font-size: 14px;
    }

    .date-inputs {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .date-input {
      width: 28%;
      max-width: 200px;
      min-width: 150px;
    }

    .date-separator {
      color: var(--admin-text-secondary);
      font-size: 14px;
      padding: 0 2px;
    }

    .customer-info .name {
      font-weight: 600;
      margin-bottom: 4px;
      color: #1F2937;
    }

    .customer-info .email {
      font-size: 12px;
      color: #6B7280;
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .status-pending {
      background: #FEF3C7;
      color: #92400E;
    }

    .status-confirmed {
      background: #DBEAFE;
      color: #1E40AF;
    }

    .status-booked {
      background: #FEE2E2;
      color: #991B1B;
    }

    .status-completed {
      background: #D1FAE5;
      color: #065F46;
    }

    .status-cancelled {
      background: #FEE2E2;
      color: #991B1B;
    }

    .action-buttons {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
    }

    .btn-action {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: transparent;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .btn-action .icon {
      width: 14px;
      height: 14px;
      stroke-width: 2;
    }

    .btn-confirm {
      border-color: #3B82F6;
      color: #3B82F6;
    }

    .btn-confirm:hover {
      background: #3B82F6;
      color: white;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
      transform: translateY(-1px);
    }

    .btn-complete {
      border-color: #10B981;
      color: #10B981;
    }

    .btn-complete:hover {
      background: #10B981;
      color: white;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
      transform: translateY(-1px);
    }

    .btn-cancel {
      border-color: #EF4444;
      color: #EF4444;
    }

    .btn-cancel:hover {
      background: #EF4444;
      color: white;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
      transform: translateY(-1px);
    }

    .btn-delete {
      border-color: #F59E0B;
      color: #F59E0B;
    }

    .btn-delete:hover {
      background: #F59E0B;
      color: white;
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.25);
      transform: translateY(-1px);
    }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      background: var(--admin-bg);
      border-radius: var(--admin-radius);
      border: 1px dashed var(--admin-border);
      box-shadow: var(--admin-shadow-sm);
    }

    .empty-state p {
      color: var(--admin-text-secondary);
      font-size: 14px;
    }


    @media (max-width: 768px) {
      .admin-table-container {
        overflow-x: auto;
      }

      .admin-data-table {
        min-width: 800px;
      }
    }
  `]
})
export class AdminBookingsComponent implements OnInit {
  bookings: any[] = [];
  statusFilter = '';
  startDateFilter = '';
  endDateFilter = '';
  searchTerm = '';
  datePreset = 'all';
  loadingList = false;
  totalRecords = 0;

  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  assignModalOpen = false;
  assignSaving = false;
  trainers: any[] = [];
  assignForm = {
    bookingId: '',
    customerName: '',
    slotTime: '',
    vehicle: '',
    trainerId: ''
  };

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService,
    public perms: PermissionService
  ) {}

  async ngOnInit() {
    await this.loadBookings();
  }

  async loadBookings() {
    this.loadingList = true;
    try {
      const limit = Number(this.itemsPerPage) || 20;
      const offset = (this.currentPage - 1) * limit;
      const res = await this.adminService.getAllBookings({
        status: this.statusFilter || undefined,
        startDate: this.startDateFilter || undefined,
        endDate: this.endDateFilter || undefined,
        search: this.searchTerm.trim() || undefined,
        limit,
        offset
      });
      this.bookings = res.bookings;
      this.totalRecords = res.total;
      this.totalPages = Math.max(1, Math.ceil(this.totalRecords / limit));
      if (this.bookings.length === 0 && this.totalRecords > 0 && offset > 0) {
        this.currentPage = 1;
        await this.loadBookings();
        return;
      }
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to load bookings'));
      this.bookings = [];
      this.totalRecords = 0;
    } finally {
      this.loadingList = false;
    }
  }

  onServerFiltersChange() {
    this.currentPage = 1;
    void this.loadBookings();
  }

  onSearchChange(value: string) {
    this.searchTerm = value ?? '';
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.applySearch();
    }, 300);
  }

  applySearch() {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
    this.currentPage = 1;
    void this.loadBookings();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      void this.loadBookings();
    }
  }

  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 3; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      }
    }
    
    return pages;
  }

  onPageSizeChange() {
    this.currentPage = 1;
    void this.loadBookings();
  }

  /** Local calendar date (YYYY-MM-DD) — avoids UTC shift from toISOString(). */
  private formatDateForFilter(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onDatePresetChange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.datePreset) {
      case 'today':
        const todayStr = this.formatDateForFilter(today);
        this.startDateFilter = todayStr;
        this.endDateFilter = todayStr;
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        this.startDateFilter = this.formatDateForFilter(last7);
        this.endDateFilter = this.formatDateForFilter(today);
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        this.startDateFilter = this.formatDateForFilter(firstDay);
        this.endDateFilter = this.formatDateForFilter(today);
        break;
      case 'all':
        this.startDateFilter = '';
        this.endDateFilter = '';
        break;
      case 'custom':
        // Keep existing dates or leave empty
        break;
    }
    this.onServerFiltersChange();
  }

  resetFilters() {
    this.searchTerm = '';
    this.statusFilter = '';
    this.datePreset = 'all';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.currentPage = 1;
    void this.loadBookings();
  }

  getStartIndex(): number {
    return this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    const end = this.currentPage * this.itemsPerPage;
    return end > this.totalRecords ? this.totalRecords : end;
  }

  getTrainerName(booking: any): string {
    return booking?.trainer?.profile?.full_name || booking?.trainer_name || '';
  }

  async openAssignTrainer(booking: any) {
    this.assignForm = {
      bookingId: booking.id,
      customerName: booking.user?.full_name || booking.user_name || 'N/A',
      slotTime:
        booking.formatted_slot_time ||
        (booking.slot?.start_time ? this.formatDateTime(booking.slot.start_time) : 'N/A'),
      vehicle: this.getVehicleLabel(booking),
      trainerId: booking.trainer_id || ''
    };
    if (!this.trainers.length) {
      try {
        this.trainers = (await this.adminService.getAllTrainers()).filter((t) => t.is_active !== false);
      } catch {
        this.trainers = [];
      }
    }
    this.assignModalOpen = true;
  }

  closeAssignTrainer() {
    this.assignModalOpen = false;
    this.assignSaving = false;
  }

  async saveTrainerAssignment() {
    if (!this.assignForm.bookingId || !this.assignForm.trainerId) return;
    this.assignSaving = true;
    try {
      await firstValueFrom(
        this.adminService.assignBookingTrainer(this.assignForm.bookingId, this.assignForm.trainerId)
      );
      this.toastService.success('Trainer assigned successfully');
      this.closeAssignTrainer();
      await this.loadBookings();
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to assign trainer'));
    } finally {
      this.assignSaving = false;
    }
  }

  async updateStatus(bookingId: string, status: string) {
    const ok = await this.confirmDialog.confirm({
      title: 'Update booking status',
      message: `Are you sure you want to mark this booking as ${status}?`,
      confirmLabel: 'Yes, update',
      variant: status === 'cancelled' ? 'danger' : 'warning'
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.adminService.updateBookingStatus(bookingId, status));

      // Reload bookings to get updated data
      await this.loadBookings();
      
      // Show success message
      const statusMessages: { [key: string]: string } = {
        'completed': 'Booking marked as completed successfully',
        'confirmed': 'Booking confirmed successfully',
        'cancelled': 'Booking cancelled successfully',
        'pending': 'Booking status set to pending',
        'no_show': 'Booking marked as no-show'
      };
      
      this.toastService.success(statusMessages[status] || `Booking ${status} successfully`);
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to update booking status'));
    }
  }

  getVehicleLabel(booking: { vehicle_name?: string }): string {
    const name = booking?.vehicle_name || '';
    const category = categorizeVehicleName(name);
    if (category === 'ev_scooty') return 'Electric Scooty';
    if (category === 'petrol_scooty') return 'Petrol Scooty';
    if (category === 'bike') return 'Bike';
    return name || 'N/A';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  async deleteBooking(bookingId: string) {
    const ok = await this.confirmDialog.confirm({
      title: 'Delete booking',
      message: 'Are you sure you want to permanently delete this booking? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await firstValueFrom(this.adminService.deleteBooking(bookingId));
      await this.loadBookings();
      this.toastService.success('Booking deleted successfully');
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to delete booking'));
    }
  }
}
