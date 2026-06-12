import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { formatUserPhoneDisplay } from '../../../utils/phone-display';

@Component({
  selector: 'app-admin-reactivation-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reactivation-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Reactivation Requests</h1>
      </div>

      <div class="admin-filters-bar">
        <div class="admin-filters-content">
          <select [(ngModel)]="statusFilter" (change)="loadRequests()" class="admin-select">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button class="admin-btn admin-btn-secondary" (click)="loadRequests()" title="Refresh">
            Refresh
          </button>
        </div>
      </div>

      <div class="admin-table-container">
        <p *ngIf="loading" class="loading-hint">Loading…</p>
        <table class="admin-data-table" *ngIf="!loading">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Request Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="requests.length === 0">
              <td colspan="6" class="empty-state-cell">No reactivation requests found</td>
            </tr>
            <tr *ngFor="let row of requests">
              <td>{{ row.user_name || 'N/A' }}</td>
              <td class="email-cell">{{ row.user_email || 'N/A' }}</td>
              <td>{{ displayPhone(row.user_phone) }}</td>
              <td>{{ formatDate(row.requested_at) }}</td>
              <td>
                <span class="status-badge" [class]="'status-' + row.status">{{ statusLabel(row.status) }}</span>
              </td>
              <td>
                <div class="action-buttons" *ngIf="row.status === 'pending'">
                  <button type="button" class="btn-action btn-approve" (click)="approve(row.id)" [disabled]="actionId === row.id">
                    Approve
                  </button>
                  <button type="button" class="btn-action btn-reject" (click)="reject(row.id)" [disabled]="actionId === row.id">
                    Reject
                  </button>
                </div>
                <span *ngIf="row.status !== 'pending'" class="reviewed-hint">Reviewed</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
      .reactivation-page {
        max-width: 1400px;
      }
      .loading-hint {
        padding: 12px 0;
        color: var(--admin-text-secondary);
      }
      .email-cell {
        max-width: 220px;
        word-break: break-word;
      }
      .empty-state-cell {
        text-align: center;
        padding: 40px 16px;
        color: var(--admin-text-secondary);
      }
      .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      .status-approved {
        background: #d1fae5;
        color: #065f46;
      }
      .status-rejected {
        background: #fee2e2;
        color: #991b1b;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn-action {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: white;
      }
      .btn-approve {
        border-color: #10b981;
        color: #059669;
      }
      .btn-approve:hover:not(:disabled) {
        background: #10b981;
        color: white;
      }
      .btn-reject {
        border-color: #ef4444;
        color: #dc2626;
      }
      .btn-reject:hover:not(:disabled) {
        background: #ef4444;
        color: white;
      }
      .btn-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .reviewed-hint {
        font-size: 12px;
        color: var(--admin-text-secondary);
      }
      @media (max-width: 768px) {
        .admin-table-container {
          overflow-x: auto;
        }
        .admin-data-table {
          min-width: 760px;
        }
      }
    `
  ]
})
export class AdminReactivationRequestsComponent implements OnInit {
  requests: any[] = [];
  loading = false;
  statusFilter = 'pending';
  actionId: string | null = null;

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    void this.loadRequests();
  }

  async loadRequests() {
    this.loading = true;
    try {
      const result = await this.adminService.getReactivationRequests({
        status: this.statusFilter || undefined
      });
      this.requests = result.requests || [];
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to load reactivation requests'));
      this.requests = [];
    } finally {
      this.loading = false;
    }
  }

  displayPhone(phone: string | null | undefined): string {
    return formatUserPhoneDisplay(phone);
  }

  formatDate(value: string): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  }

  statusLabel(status: string): string {
    if (status === 'pending') return 'Pending';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return status;
  }

  async approve(id: string) {
    if (!confirm('Approve this reactivation request and reactivate the customer account?')) return;
    this.actionId = id;
    try {
      await firstValueFrom(this.adminService.approveReactivationRequest(id));
      this.toastService.success('Account reactivated');
      await this.loadRequests();
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to approve request'));
    } finally {
      this.actionId = null;
    }
  }

  async reject(id: string) {
    if (!confirm('Reject this reactivation request?')) return;
    this.actionId = id;
    try {
      await firstValueFrom(this.adminService.rejectReactivationRequest(id));
      this.toastService.success('Request rejected');
      await this.loadRequests();
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to reject request'));
    } finally {
      this.actionId = null;
    }
  }
}
