import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="users-page">
      <h1 class="page-title">Manage Users</h1>
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
          <tr *ngFor="let user of users">
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
  `]
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];

  constructor(
    private adminService: AdminService,
    public auth: AuthService
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.users = await this.adminService.getAllUsers();
  }

  async updateRole(userId: string, role: string) {
    if (!confirm(`Update user role to ${role}?`)) return;
    await this.adminService.updateUserRole(userId, role);
    await this.loadUsers();
  }

  formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }
}
