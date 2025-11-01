import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';

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

        <button class="btn-refresh" (click)="loadBookings()">🔄 Refresh</button>
      </div>

      <div class="table-container">
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
            <tr *ngFor="let booking of bookings">
              <td>
                <div class="customer-info">
                  <div class="name">{{ booking.user?.full_name }}</div>
                  <div class="email">{{ booking.user?.email }}</div>
                </div>
              </td>
              <td>{{ booking.trainer?.profile?.full_name }}</td>
              <td>{{ formatDateTime(booking.slot?.start_time) }}</td>
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

        <div *ngIf="bookings.length === 0" class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No bookings found</p>
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

    .status-completed {
      background: #d1fae5;
      color: #065f46;
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
  statusFilter = '';
  startDateFilter = '';
  endDateFilter = '';

  constructor(private adminService: AdminService) {}

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
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  applyFilters() {
    this.loadBookings();
  }

  async updateStatus(bookingId: string, status: string) {
    if (!confirm(`Are you sure you want to ${status} this booking?`)) return;

    try {
      await this.adminService.updateBookingStatus(bookingId, status);
      await this.loadBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Failed to update booking status');
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
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      alert(error.error?.error || error.error?.message || 'Failed to delete booking');
    }
  }
}
