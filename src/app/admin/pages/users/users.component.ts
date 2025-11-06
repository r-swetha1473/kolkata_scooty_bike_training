import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-page">
      <h1 class="page-title">Manage Users</h1>
      
      <div class="filters-bar">
        <input 
          type="text" 
          [(ngModel)]="searchTerm" 
          (input)="filterUsers()"
          placeholder="Search by name, email, or role..." 
          class="search-input">
        <select [(ngModel)]="roleFilter" (change)="filterUsers()" class="filter-select">
          <option value="">All Roles</option>
          <option value="customer">Customer</option>
          <option value="trainer">Trainer</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="page-size-select">
          <option [value]="10">10 per page</option>
          <option [value]="20">20 per page</option>
          <option [value]="50">50 per page</option>
          <option [value]="100">100 per page</option>
        </select>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Joined</th>
              <th *ngIf="auth.isSuperAdmin()">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of getPaginatedUsers()">
            <td>{{ user.full_name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.phone || 'N/A' }}</td>
            <td><span class="role-badge">{{ user.role }}</span></td>
            <td>{{ formatDate(user.created_at) }}</td>
            <td *ngIf="auth.isSuperAdmin()">
              <select (change)="updateRole(user.id, $any($event.target).value)" [value]="user.role">
                <option value="customer">Customer</option>
                <option value="trainer">Trainer</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div class="pagination-container" *ngIf="totalPages > 1">
        <button 
          class="pagination-btn" 
          [disabled]="currentPage === 1"
          (click)="goToPage(currentPage - 1)">
          ← Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }} ({{ filteredUsers.length }} users)
        </span>
        <button 
          class="pagination-btn" 
          [disabled]="currentPage === totalPages"
          (click)="goToPage(currentPage + 1)">
          Next →
        </button>
      </div>
    </div>
  `,
  styles: [`
    .users-page { max-width: 1400px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin-bottom: 24px; }
    .data-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .data-table th, .data-table td { padding: 16px; text-align: left; }
    .data-table thead { background: #f9fafb; }
    .data-table tbody tr { border-top: 1px solid #e5e7eb; }
    .role-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1e40af; text-transform: capitalize; }
    select { padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; }
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 200px; padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .search-input:focus { outline: none; border-color: #3b82f6; }
    .filter-select, .page-size-select { padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .pagination-container { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; padding: 20px; }
    .pagination-btn { padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .pagination-btn:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
    .pagination-btn:not(:disabled):hover { transform: translateY(-2px); }
    .page-info { color: #6b7280; font-size: 14px; }
    .table-container { overflow-x: auto; }
  `]
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  searchTerm = '';
  roleFilter = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;

  constructor(
    private adminService: AdminService,
    public auth: AuthService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    try {
      this.users = await this.adminService.getAllUsers();
      this.filterUsers();
    } catch (error) {
      console.error('Failed to load users:', error);
      this.toastService.error('Failed to load users');
    }
  }

  filterUsers() {
    let filtered = [...this.users];
    
    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.role?.toLowerCase().includes(term)
      );
    }
    
    // Filter by role
    if (this.roleFilter) {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }
    
    this.filteredUsers = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
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

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  async updateRole(userId: string, role: string) {
    if (!confirm(`Update user role to ${role}?`)) return;
    try {
      await this.adminService.updateUserRole(userId, role);
      await this.loadUsers();
      this.toastService.success(`User role updated to ${role} successfully`);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to update user role');
    }
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }
}
