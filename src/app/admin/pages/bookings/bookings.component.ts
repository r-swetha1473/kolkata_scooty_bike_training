import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ToastService } from '../../../services/toast.service';
import { firstValueFrom } from 'rxjs';
import { extractDateFromDateTime } from '../../../utils/date.utils';

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
              type="text" 
              [(ngModel)]="searchTerm" 
              (input)="applyFilters()"
              placeholder="Search customer, trainer, phone, booking ID..." 
              class="admin-search-input">
          </div>

          <select [(ngModel)]="statusFilter" (change)="applyFilters()" class="admin-select">
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
                (change)="applyFilters()"
                class="admin-select date-input">
              <span class="date-separator">–</span>
              <input
                type="date"
                [(ngModel)]="endDateFilter"
                (change)="applyFilters()"
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

      <div class="admin-table-container">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Trainer</th>
              <th>Slot Time</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let booking of getPaginatedBookings()">
              <td>
                <div class="customer-info">
                  <div class="name">{{ booking.user?.full_name || booking.user_name || 'N/A' }}</div>
                  <div class="email">{{ booking.user?.email || booking.user_email || '' }}</div>
                </div>
              </td>
              <td>{{ booking.trainer?.profile?.full_name || booking.trainer_name || 'N/A' }}</td>
              <td>{{ booking.slot?.start_time ? formatDateTime(booking.slot.start_time) : (booking.start_time ? formatDateTime(booking.start_time) : 'N/A') }}</td>
              <td>
                <span class="status-badge" [class]="'status-' + booking.status">
                  {{ booking.status }}
                </span>
              </td>
              <td>{{ formatDate(booking.created_at) }}</td>
              <td>
                <div class="actions">
                  <button
                    *ngIf="booking.status === 'pending'"
                    class="btn-action btn-confirm"
                    (click)="updateStatus(booking.id, 'confirmed')">
                    Confirm
                  </button>
                  <button
                    *ngIf="booking.status === 'confirmed'"
                    class="btn-action btn-complete"
                    (click)="updateStatus(booking.id, 'completed')">
                    Complete
                  </button>
                  <button
                    *ngIf="['pending', 'confirmed'].includes(booking.status)"
                    class="btn-action btn-cancel"
                    (click)="updateStatus(booking.id, 'cancelled')">
                    Cancel
                  </button>
                  <button
                    class="btn-action btn-delete"
                    (click)="deleteBooking(booking.id)">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="filteredBookings.length === 0" class="empty-state">
          <p>No bookings found</p>
        </div>
      </div>

      <div class="admin-pagination" *ngIf="filteredBookings.length > 0">
        <div class="admin-pagination-info">
          <span class="admin-pagination-count">Showing {{ getStartIndex() }}–{{ getEndIndex() }} of {{ filteredBookings.length }} bookings</span>
          <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="admin-page-size-select">
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
    </div>
  `,
  styles: [`
    .bookings-page {
      max-width: 1400px;
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

    .actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .btn-action {
      padding: 5px 10px;
      border: none;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .btn-confirm {
      background: #DBEAFE;
      color: #1E40AF;
    }

    .btn-confirm:hover {
      background: #3B82F6;
      color: white;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
      transform: translateY(-1px);
    }

    .btn-complete {
      background: #D1FAE5;
      color: #065F46;
    }

    .btn-complete:hover {
      background: #10B981;
      color: white;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
      transform: translateY(-1px);
    }

    .btn-cancel {
      background: #FEE2E2;
      color: #991B1B;
    }

    .btn-cancel:hover {
      background: #EF4444;
      color: white;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
      transform: translateY(-1px);
    }

    .btn-delete {
      background: #FEF3C7;
      color: #92400E;
    }

    .btn-delete:hover {
      background: #F59E0B;
      color: white;
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
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
  filteredBookings: any[] = [];
  statusFilter = '';
  startDateFilter = '';
  endDateFilter = '';
  searchTerm = '';
  datePreset = 'all';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadBookings();
  }

  async loadBookings() {
    try {
      const filters: any = {};
      if (this.statusFilter) filters.status = this.statusFilter;
      if (this.startDateFilter) filters.startDate = this.startDateFilter;
      if (this.endDateFilter) filters.endDate = this.endDateFilter;

      this.bookings = await this.adminService.getAllBookings(filters);
      this.applyFilters();
    } catch (error) {
      console.error('Error loading bookings:', error);
      this.toastService.error('Failed to load bookings');
    }
  }

  applyFilters() {
    let filtered = [...this.bookings];
    
    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(booking => {
        const customerName = (booking.user?.full_name || booking.user_name || '').toLowerCase();
        const customerEmail = (booking.user?.email || booking.user_email || '').toLowerCase();
        const trainerName = (booking.trainer?.profile?.full_name || booking.trainer_name || '').toLowerCase();
        const phone = (booking.user?.phone || booking.user_phone || '').toLowerCase();
        const bookingId = (booking.id || '').toLowerCase();
        return customerName.includes(term) || 
               customerEmail.includes(term) || 
               trainerName.includes(term) ||
               phone.includes(term) ||
               bookingId.includes(term);
      });
    }
    
    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(booking => booking.status === this.statusFilter);
    }
    
    // Filter by date range
    if (this.startDateFilter) {
      filtered = filtered.filter(booking => {
        const bookingDate = booking.slot?.slot_date || extractDateFromDateTime(booking.slot?.start_time);
        return bookingDate && bookingDate >= this.startDateFilter;
      });
    }
    
    if (this.endDateFilter) {
      filtered = filtered.filter(booking => {
        const bookingDate = booking.slot?.slot_date || extractDateFromDateTime(booking.slot?.start_time);
        return bookingDate && bookingDate <= this.endDateFilter;
      });
    }
    
    this.filteredBookings = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredBookings.length / this.itemsPerPage);
  }

  getPaginatedBookings(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredBookings.slice(start, end);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
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
    this.updatePagination();
  }

  onDatePresetChange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (this.datePreset) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        this.startDateFilter = todayStr;
        this.endDateFilter = todayStr;
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        this.startDateFilter = last7.toISOString().split('T')[0];
        this.endDateFilter = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        this.startDateFilter = firstDay.toISOString().split('T')[0];
        this.endDateFilter = today.toISOString().split('T')[0];
        break;
      case 'all':
        this.startDateFilter = '';
        this.endDateFilter = '';
        break;
      case 'custom':
        // Keep existing dates or leave empty
        break;
    }
    this.applyFilters();
  }

  resetFilters() {
    this.searchTerm = '';
    this.statusFilter = '';
    this.datePreset = 'all';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  getStartIndex(): number {
    return this.filteredBookings.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    const end = this.currentPage * this.itemsPerPage;
    return end > this.filteredBookings.length ? this.filteredBookings.length : end;
  }

  async updateStatus(bookingId: string, status: string) {
    if (!confirm(`Are you sure you want to mark this booking as ${status}?`)) return;

    try {
      console.log(`[Booking] Updating booking ${bookingId} to status: ${status}`);
      const result = await firstValueFrom(this.adminService.updateBookingStatus(bookingId, status));
      console.log(`[Booking] Update result:`, result);
      
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
    } catch (error: any) {
      console.error('[Booking] Error updating booking status:', error);
      const errorMessage = error?.error?.error || error?.error?.message || error?.message || 'Failed to update booking status';
      this.toastService.error(errorMessage);
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  async deleteBooking(bookingId: string) {
    if (!confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) {
      return;
    }

    try {
      await firstValueFrom(this.adminService.deleteBooking(bookingId));
      await this.loadBookings();
      this.toastService.success('Booking deleted successfully');
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      this.toastService.error(error.error?.error || error.error?.message || 'Failed to delete booking');
    }
  }
}
