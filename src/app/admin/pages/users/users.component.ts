import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Manage Users</h1>
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
              (keyup.enter)="applyFilters()"
              placeholder="Search users..." 
              class="admin-search-input"
              aria-label="Search users">
          </div>
          <select [(ngModel)]="roleFilter" (change)="applyFilters()" class="admin-select">
            <option value="">All Roles</option>
            <option value="customer">Customer</option>
            <option value="trainer">Trainer</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
            <option value="subadmin">Sub Admin</option>
          </select>
          <div class="admin-filter-spacer"></div>
          <button class="admin-btn admin-btn-secondary" (click)="exportUsers()" [disabled]="loadingList || filteredUsers.length === 0" title="Export to CSV">
            <svg class="admin-btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
      </div>

      <div class="admin-table-container">
        <p *ngIf="loadingList" class="loading-hint">Loading users…</p>
        <table class="admin-data-table" *ngIf="!loadingList">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Account</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="filteredUsers.length === 0">
              <td colspan="6" class="empty-state-cell">
                {{ loadError ? 'Unable to load users' : 'No users found' }}
              </td>
            </tr>
            <tr *ngFor="let user of getPaginatedUsers()">
              <td>{{ user.full_name }}</td>
              <td class="email-cell">{{ user.email }}</td>
              <td class="auth-cell">
                <span *ngIf="user.phone" class="auth-badge phone-badge">{{ user.phone }}</span>
                <span *ngIf="!user.phone && user.google_id" class="auth-badge google-badge">Google</span>
                <span *ngIf="!user.phone && !user.google_id" class="auth-badge guest-badge">Guest</span>
              </td>
              <td>
                <span *ngIf="user.inactive_blocked" class="status-blocked">Inactive (blocked)</span>
                <span *ngIf="!user.inactive_blocked" class="status-active">Active</span>
                <button
                  *ngIf="user.inactive_blocked && user.role === 'customer'"
                  type="button"
                  class="btn-reactivate"
                  (click)="reactivateCustomer(user.id)">
                  Reactivate
                </button>
              </td>
              <td><span class="role-badge">{{ user.role }}</span></td>
              <td>{{ formatDate(user.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-pagination" *ngIf="!loadingList && filteredUsers.length > 0">
        <div class="admin-pagination-info">
          <span class="admin-pagination-count">Showing {{ getStartIndex() }}–{{ getEndIndex() }} of {{ totalRecords }} users</span>
          <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="admin-page-size-select">
            <option [value]="8">8</option>
            <option [value]="16">16</option>
            <option [value]="24">24</option>
            <option [value]="32">32</option>
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
    .users-page { max-width: 1400px; }
    .email-cell { font-size: 12px; color: #9ca3af; font-weight: 400; }
    .role-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 500; background: #dbeafe; color: #1e40af; text-transform: capitalize; display: inline-block; }
    .empty-state-cell { text-align: center; padding: 40px; color: #6b7280; }
    .loading-hint { padding: 16px 0; color: var(--admin-text-secondary, #6B7280); }

    .auth-cell {
      display: flex;
      align-items: center;
    }

    .auth-badge {
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
      display: inline-block;
      white-space: nowrap;
    }

    .phone-badge {
      background: #F3F4F6;
      color: #374151;
    }

    .google-badge {
      background: #DBEAFE;
      color: #1E40AF;
    }

    .guest-badge {
      background: #FEF3C7;
      color: #92400E;
    }

    .status-active { font-size: 12px; color: #059669; font-weight: 600; }
    .status-blocked { font-size: 12px; color: #b91c1c; font-weight: 600; display: block; margin-bottom: 6px; }
    .btn-reactivate {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 6px;
      border: 1px solid #2563eb;
      background: #eff6ff;
      color: #1d4ed8;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-reactivate:hover { background: #dbeafe; }

    .admin-data-table { min-width: 720px; }

    @media (max-width: 768px) {
      .admin-page-header,
      .admin-filters-content {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-page-actions .admin-btn,
      .admin-filter-group .admin-select,
      .admin-search-group {
        width: 100%;
        max-width: 100%;
        min-width: 100%;
      }

      .admin-pagination {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-pagination-info {
        justify-content: space-between;
      }
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  totalRecords = 0;
  searchTerm = '';
  roleFilter = '';
  loadingList = false;
  loadError = false;

  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 1;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.loadingList = true;
    this.loadError = false;
    try {
      const res = await this.adminService.getAllUsers({
        role: this.roleFilter || undefined,
        search: this.searchTerm.trim() || undefined
      });
      this.users = res.users;
      this.filteredUsers = res.users;
      this.totalRecords = res.total;
      this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.itemsPerPage));
      if (this.filteredUsers.length === 0 && this.totalRecords > 0 && this.currentPage > 1) {
        this.currentPage = 1;
        await this.loadUsers();
        return;
      }
      console.log('[AdminUsers] loaded', {
        role: this.roleFilter || 'all',
        search: this.searchTerm || null,
        total: this.totalRecords,
        returned: this.users.length
      });
    } catch (err) {
      this.loadError = true;
      this.users = [];
      this.filteredUsers = [];
      this.totalRecords = 0;
      console.error('[AdminUsers] load failed', err);
      this.toastService.error(getApiErrorMessage(err, 'Failed to load users'));
    } finally {
      this.loadingList = false;
    }
  }

  onSearchChange(value: string) {
    this.searchTerm = value ?? '';
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 300);
  }

  applyFilters() {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }
    this.currentPage = 1;
    void this.loadUsers();
  }

  getPaginatedUsers(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
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
      for (let i = 1; i <= total; i++) pages.push(i);
    } else if (current <= 3) {
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

    return pages;
  }

  getStartIndex(): number {
    return this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    const end = this.currentPage * this.itemsPerPage;
    return end > this.totalRecords ? this.totalRecords : end;
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.itemsPerPage));
  }

  async reactivateCustomer(userId: string) {
    try {
      await firstValueFrom(this.adminService.updateUser(userId, { inactive_blocked: false }));
      await this.loadUsers();
      this.toastService.success('Customer reactivated');
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to reactivate'));
    }
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }

  exportUsers() {
    const headers = ['Name', 'Email', 'Phone/Auth', 'Role', 'Joined'];
    const rows = this.filteredUsers.map(user => [
      user.full_name || '',
      user.email || '',
      user.phone || (user.google_id ? 'Google' : 'Guest'),
      user.role || '',
      this.formatDate(user.created_at)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toastService.success('Users exported successfully');
  }
}
