import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bookings-page">
      <div class="page-header">
        <h1 class="page-title">Manage Bookings</h1>
      </div>

      <div class="filters-bar">
        <input 
          type="text" 
          [(ngModel)]="searchTerm" 
          (input)="applyFilters()"
          placeholder="Search by customer or trainer name..." 
          class="search-input">
        <select [(ngModel)]="statusFilter" (change)="applyFilters()" class="filter-select">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          [(ngModel)]="startDateFilter"
          (change)="applyFilters()"
          class="filter-input"
          placeholder="Start Date">

        <input
          type="date"
          [(ngModel)]="endDateFilter"
          (change)="applyFilters()"
          class="filter-input"
          placeholder="End Date">

        <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="page-size-select">
          <option [value]="10">10 per page</option>
          <option [value]="20">20 per page</option>
          <option [value]="50">50 per page</option>
          <option [value]="100">100 per page</option>
        </select>

        <button class="btn-refresh" (click)="loadBookings()">🔄 Refresh</button>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table">
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
                    ✓ Confirm
                  </button>
                  <button
                    *ngIf="booking.status === 'confirmed'"
                    class="btn-action btn-complete"
                    (click)="updateStatus(booking.id, 'completed')">
                    ✓ Complete
                  </button>
                  <button
                    *ngIf="['pending', 'confirmed'].includes(booking.status)"
                    class="btn-action btn-cancel"
                    (click)="updateStatus(booking.id, 'cancelled')">
                    ✕ Cancel
                  </button>
                  <button
                    class="btn-action btn-delete"
                    (click)="deleteBooking(booking.id)">
                    🗑️ Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="filteredBookings.length === 0" class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No bookings found</p>
        </div>
      </div>

      <div class="pagination-wrapper" *ngIf="totalPages > 1">
        <div class="pagination-container">
          <button 
            class="pagination-btn" 
            [disabled]="currentPage === 1"
            (click)="goToPage(currentPage - 1)">
            ← Prev
          </button>
          <div class="pagination-info">
            <span class="page-numbers">
              <button 
                *ngFor="let page of getPageNumbers()"
                class="page-number"
                [class.active]="page === currentPage"
                [class.ellipsis]="page === '...'"
                [disabled]="page === '...'"
                (click)="page !== '...' && goToPage(page)">
                {{ page }}
              </button>
            </span>
            <span class="page-info-text">
              Page {{ currentPage }} of {{ totalPages }} ({{ filteredBookings.length }} total)
            </span>
          </div>
          <button 
            class="pagination-btn" 
            [disabled]="currentPage === totalPages"
            (click)="goToPage(currentPage + 1)">
            Next →
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bookings-page {
      max-width: 1400px;
    }

    .page-header {
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #1f2937;
      margin: 0;
    }

    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-select, .filter-input {
      padding: 10px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .filter-select:focus, .filter-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .btn-refresh {
      padding: 10px 20px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-refresh:hover {
      background: #5568d3;
    }

    .table-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .data-table thead {
      background: #f9fafb;
    }

    .data-table th {
      padding: 16px;
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .data-table td {
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #1f2937;
    }

    .customer-info .name {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .customer-info .email {
      font-size: 12px;
      color: #6b7280;
    }

    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-confirmed {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-booked {
      background: #fee2e2;
      color: #991b1b;
    }

    .status-completed {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #10b981;
    }

    .status-cancelled {
      background: #fee2e2;
      color: #991b1b;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .btn-action {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-confirm {
      background: #dbeafe;
      color: #1e40af;
    }

    .btn-confirm:hover {
      background: #3b82f6;
      color: white;
    }

    .btn-complete {
      background: #d1fae5;
      color: #065f46;
    }

    .btn-complete:hover {
      background: #10b981;
      color: white;
    }

    .btn-cancel {
      background: #fee2e2;
      color: #991b1b;
    }

    .btn-cancel:hover {
      background: #ef4444;
      color: white;
    }

    .btn-delete {
      background: #fef3c7;
      color: #92400e;
    }

    .btn-delete:hover {
      background: #f59e0b;
      color: white;
    }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
    }

    .search-input { flex: 1; min-width: 200px; padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .search-input:focus { outline: none; border-color: #667eea; }
    .page-size-select { padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .pagination-wrapper { margin-top: 24px; padding: 20px 0; border-top: 1px solid #e5e7eb; }
    .pagination-container { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .pagination-btn { padding: 8px 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; }
    .pagination-btn:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; transform: none; }
    .pagination-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3); }
    .pagination-info { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; }
    .page-numbers { display: flex; gap: 4px; align-items: center; }
    .page-number { padding: 6px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: #4b5563; transition: all 0.2s; min-width: 36px; }
    .page-number:hover:not(:disabled) { background: #f3f4f6; border-color: #3b82f6; color: #3b82f6; }
    .page-number.active { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-color: #3b82f6; }
    .page-number.ellipsis { border: none; background: none; cursor: default; }
    .page-number:disabled { cursor: default; }
    .page-info-text { color: #6b7280; font-size: 12px; }

    .empty-icon {
      font-size: 60px;
      margin-bottom: 16px;
    }

    .empty-state p {
      color: #6b7280;
      font-size: 16px;
    }

    @media (max-width: 768px) {
      .filters-bar {
        flex-direction: column;
      }

      .table-container {
        overflow-x: auto;
      }

      .data-table {
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
        return customerName.includes(term) || customerEmail.includes(term) || trainerName.includes(term);
      });
    }
    
    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(booking => booking.status === this.statusFilter);
    }
    
    // Filter by date range
    if (this.startDateFilter) {
      filtered = filtered.filter(booking => {
        const bookingDate = booking.slot?.slot_date || (booking.slot?.start_time ? new Date(booking.slot.start_time).toISOString().split('T')[0] : null);
        return bookingDate && bookingDate >= this.startDateFilter;
      });
    }
    
    if (this.endDateFilter) {
      filtered = filtered.filter(booking => {
        const bookingDate = booking.slot?.slot_date || (booking.slot?.start_time ? new Date(booking.slot.start_time).toISOString().split('T')[0] : null);
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

  async updateStatus(bookingId: string, status: string) {
    if (!confirm(`Are you sure you want to mark this booking as ${status}?`)) return;

    try {
      console.log(`[Booking] Updating booking ${bookingId} to status: ${status}`);
      const result = await this.adminService.updateBookingStatus(bookingId, status).toPromise();
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
      await this.adminService.deleteBooking(bookingId).toPromise();
      await this.loadBookings();
      this.toastService.success('Booking deleted successfully');
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      this.toastService.error(error.error?.error || error.error?.message || 'Failed to delete booking');
    }
  }
}
