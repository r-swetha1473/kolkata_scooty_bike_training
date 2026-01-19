import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';

interface AuditLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_value: any;
  after_value: any;
  details: any;
  created_at: string;
}

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audit-logs-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Audit Logs</h1>
        <div class="admin-page-actions">
          <button class="admin-btn admin-btn-secondary" (click)="loadLogs()" title="Refresh">
            <svg class="admin-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
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
              placeholder="Search admin name, action, entity..." 
              class="admin-search-input">
          </div>
          <div class="admin-filter-group">
            <select [(ngModel)]="entityTypeFilter" (change)="applyFilters()" class="admin-select">
              <option value="">All Entities</option>
              <option value="slot">Slots</option>
              <option value="vehicle">Vehicles</option>
              <option value="booking">Bookings</option>
              <option value="trainer">Trainers</option>
              <option value="user">Users</option>
            </select>
          </div>
          <div class="admin-filter-group">
            <select [(ngModel)]="actionTypeFilter" (change)="applyFilters()" class="admin-select">
              <option value="">All Actions</option>
              <option value="CREATE_SLOT">Create Slot</option>
              <option value="UPDATE_SLOT">Update Slot</option>
              <option value="DELETE_SLOT">Delete Slot</option>
              <option value="CREATE_VEHICLE">Create Vehicle</option>
              <option value="UPDATE_VEHICLE">Update Vehicle</option>
              <option value="DELETE_VEHICLE">Delete Vehicle</option>
              <option value="CANCEL_BOOKING">Cancel Booking</option>
              <option value="UPDATE_VEHICLE_CAPACITY">Update Vehicle Capacity</option>
            </select>
          </div>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let log of getPaginatedLogs()">
              <td class="timestamp-cell">
                <div class="timestamp">{{ formatDateTime(log.created_at) }}</div>
                <div class="timestamp-relative">{{ getRelativeTime(log.created_at) }}</div>
              </td>
              <td>
                <div class="admin-info">
                  <div class="admin-name">{{ log.admin_name || 'Unknown' }}</div>
                  <div class="admin-email">{{ log.admin_email || '' }}</div>
                </div>
              </td>
              <td>
                <span class="action-badge" [class]="'action-' + log.action_type.toLowerCase().replace('_', '-')">
                  {{ formatActionType(log.action_type) }}
                </span>
              </td>
              <td>
                <div class="entity-info">
                  <span class="entity-type">{{ log.entity_type }}</span>
                  <span class="entity-id" *ngIf="log.entity_id">{{ log.entity_id.substring(0, 8) }}...</span>
                </div>
              </td>
              <td>
                <button 
                  class="btn-view-details" 
                  (click)="viewDetails(log)"
                  title="View details">
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="getPaginatedLogs().length === 0" class="empty-state">
          <p>No audit logs found</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="admin-pagination" *ngIf="filteredLogs.length > itemsPerPage">
        <button 
          class="pagination-btn" 
          (click)="currentPage = currentPage - 1" 
          [disabled]="currentPage === 1">
          Previous
        </button>
        <span class="pagination-info">
          Page {{ currentPage }} of {{ getTotalPages() }} ({{ filteredLogs.length }} total)
        </span>
        <button 
          class="pagination-btn" 
          (click)="currentPage = currentPage + 1" 
          [disabled]="currentPage >= getTotalPages()">
          Next
        </button>
      </div>

      <!-- Details Modal -->
      <div *ngIf="showDetailsModal" class="modal-overlay" (click)="showDetailsModal = false">
        <div class="modal-content modal-large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Audit Log Details</h2>
            <button class="btn-close" (click)="showDetailsModal = false">&times;</button>
          </div>
          <div class="modal-body" *ngIf="selectedLog">
            <div class="detail-section">
              <h3>Basic Information</h3>
              <div class="detail-row">
                <span class="detail-label">Admin:</span>
                <span class="detail-value">{{ selectedLog.admin_name || 'Unknown' }} ({{ selectedLog.admin_email || 'N/A' }})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Action:</span>
                <span class="detail-value">{{ formatActionType(selectedLog.action_type) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Entity:</span>
                <span class="detail-value">{{ selectedLog.entity_type }} ({{ selectedLog.entity_id }})</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-value">{{ formatDateTime(selectedLog.created_at) }}</span>
              </div>
            </div>

            <div class="detail-section" *ngIf="selectedLog.before_value">
              <h3>Before</h3>
              <pre class="json-view">{{ formatJSON(selectedLog.before_value) }}</pre>
            </div>

            <div class="detail-section" *ngIf="selectedLog.after_value">
              <h3>After</h3>
              <pre class="json-view">{{ formatJSON(selectedLog.after_value) }}</pre>
            </div>

            <div class="detail-section" *ngIf="selectedLog.details">
              <h3>Details</h3>
              <pre class="json-view">{{ formatJSON(selectedLog.details) }}</pre>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="showDetailsModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .audit-logs-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .admin-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .admin-page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--admin-text);
      margin: 0;
    }

    .admin-page-actions {
      display: flex;
      gap: 12px;
    }

    .admin-btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .admin-btn-secondary {
      background: white;
      color: var(--admin-text);
      border: 1px solid var(--admin-border);
    }

    .admin-btn-secondary:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
    }

    .admin-btn-icon {
      width: 14px;
      height: 14px;
    }

    .admin-filters-bar {
      background: white;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .admin-filters-content {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .admin-filter-group {
      display: flex;
      align-items: center;
    }

    .admin-search-group {
      flex: 1;
      max-width: 33%;
      position: relative;
    }

    .admin-search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--admin-text-secondary);
    }

    .admin-search-input {
      width: 100%;
      padding: 10px 12px 10px 36px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      font-size: 14px;
    }

    .admin-select {
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      font-size: 14px;
      min-width: 150px;
    }

    .admin-table-container {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .admin-data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .admin-data-table thead {
      background: #F9FAFB;
      border-bottom: 2px solid var(--admin-border);
    }

    .admin-data-table th {
      padding: 16px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      color: var(--admin-text);
    }

    .admin-data-table td {
      padding: 16px;
      border-bottom: 1px solid var(--admin-border);
      font-size: 14px;
    }

    .admin-data-table tbody tr:hover {
      background: #F9FAFB;
    }

    .timestamp-cell {
      min-width: 140px;
    }

    .timestamp {
      font-weight: 600;
      color: var(--admin-text);
      font-size: 13px;
    }

    .timestamp-relative {
      font-size: 12px;
      color: var(--admin-text-secondary);
      margin-top: 4px;
    }

    .admin-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .admin-name {
      font-weight: 600;
      color: var(--admin-text);
    }

    .admin-email {
      font-size: 12px;
      color: var(--admin-text-secondary);
    }

    .action-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #E5E7EB;
      color: #374151;
    }

    .action-badge.action-create-slot,
    .action-badge.action-create-vehicle {
      background: #D1FAE5;
      color: #065F46;
    }

    .action-badge.action-update-slot,
    .action-badge.action-update-vehicle,
    .action-badge.action-update-vehicle-capacity {
      background: #DBEAFE;
      color: #1E40AF;
    }

    .action-badge.action-delete-slot,
    .action-badge.action-delete-vehicle {
      background: #FEE2E2;
      color: #991B1B;
    }

    .action-badge.action-cancel-booking {
      background: #FEF3C7;
      color: #92400E;
    }

    .entity-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .entity-type {
      font-weight: 600;
      color: var(--admin-text);
      text-transform: capitalize;
    }

    .entity-id {
      font-size: 11px;
      color: var(--admin-text-secondary);
      font-family: monospace;
    }

    .btn-view-details {
      padding: 6px 12px;
      background: white;
      border: 1px solid var(--admin-border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--admin-primary);
      transition: all 0.2s;
    }

    .btn-view-details:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
    }

    .empty-state {
      padding: 48px;
      text-align: center;
      color: var(--admin-text-secondary);
    }

    .admin-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 24px;
    }

    .pagination-btn {
      padding: 8px 16px;
      border: 1px solid var(--admin-border);
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-info {
      font-size: 14px;
      color: var(--admin-text-secondary);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      padding: 0;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-large {
      max-width: 900px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid var(--admin-border);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 24px;
      color: var(--admin-text);
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 32px;
      cursor: pointer;
      color: var(--admin-text-secondary);
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close:hover {
      color: var(--admin-text);
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .detail-section {
      margin-bottom: 24px;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .detail-section h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--admin-text);
    }

    .detail-row {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .detail-label {
      font-weight: 600;
      color: var(--admin-text-secondary);
      min-width: 100px;
    }

    .detail-value {
      color: var(--admin-text);
      flex: 1;
    }

    .json-view {
      background: #F9FAFB;
      border: 1px solid var(--admin-border);
      border-radius: 6px;
      padding: 12px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 24px;
      border-top: 1px solid var(--admin-border);
    }

    .btn-secondary {
      padding: 10px 20px;
      border: 1px solid var(--admin-border);
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .btn-secondary:hover {
      background: var(--admin-bg-hover);
    }
  `]
})
export class AdminAuditLogsComponent implements OnInit {
  logs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTerm = '';
  entityTypeFilter = '';
  actionTypeFilter = '';
  currentPage = 1;
  itemsPerPage = 20;
  showDetailsModal = false;
  selectedLog: AuditLog | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs() {
    try {
      const params: any = { limit: 500, offset: 0 };
      if (this.entityTypeFilter) params.entity_type = this.entityTypeFilter;
      if (this.actionTypeFilter) params.action_type = this.actionTypeFilter;

      const queryString = new URLSearchParams(params).toString();
      this.logs = await this.api.get<AuditLog[]>(`/admin/audit-logs?${queryString}`);
      this.applyFilters();
    } catch (error: any) {
      this.toast.error(error?.error?.error || 'Failed to load audit logs');
    }
  }

  applyFilters() {
    let filtered = [...this.logs];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        (log.admin_name && log.admin_name.toLowerCase().includes(term)) ||
        (log.admin_email && log.admin_email.toLowerCase().includes(term)) ||
        log.action_type.toLowerCase().includes(term) ||
        log.entity_type.toLowerCase().includes(term) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(term))
      );
    }

    this.filteredLogs = filtered;
    this.currentPage = 1;
  }

  getPaginatedLogs(): AuditLog[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredLogs.slice(start, end);
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.itemsPerPage);
  }

  viewDetails(log: AuditLog) {
    this.selectedLog = log;
    this.showDetailsModal = true;
  }

  formatActionType(actionType: string): string {
    return actionType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  formatJSON(obj: any): string {
    if (!obj) return 'N/A';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }
}
