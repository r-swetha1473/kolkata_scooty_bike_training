import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminService, SubAdmin } from '../../../services/admin.service';
import { ModulePermission } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';

const MODULES = ['dashboard', 'users', 'trainers', 'vehicles', 'bookings', 'slots', 'audit_logs', 'settings'];

function defaultPermissions(): ModulePermission[] {
  return MODULES.map((module) => ({
    module,
    can_view: module !== 'settings',
    can_create: false,
    can_edit: false,
    can_delete: false
  }));
}

@Component({
  selector: 'app-admin-sub-admins',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sub-admins-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Admin Accounts</h1>
        <div class="admin-page-actions">
          <button class="admin-btn admin-btn-primary" (click)="openCreateModal()">Create Sub Admin</button>
        </div>
      </div>

      <h2 class="section-title">Admins</h2>
      <div class="admin-table-container">
        <table class="admin-data-table sub-admins-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="loadingAdmins">
              <td colspan="5" class="empty-state-cell">Loading…</td>
            </tr>
            <tr *ngIf="!loadingAdmins && admins.length === 0">
              <td colspan="5" class="empty-state-cell">No admin accounts</td>
            </tr>
            <tr *ngFor="let admin of admins">
              <td>{{ admin.full_name }}</td>
              <td class="email-cell">{{ admin.email }}</td>
              <td>
                <span class="status-badge" [class.active]="admin.admin_is_active" [class.inactive]="!admin.admin_is_active">
                  {{ admin.admin_is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <span class="pwd-flag" *ngIf="admin.must_change_password">Must change on login</span>
                <span *ngIf="!admin.must_change_password">—</span>
              </td>
              <td class="actions-cell">
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openResetModal(admin)">
                  Reset Password
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="section-title">Sub Admins</h2>
      <div class="admin-table-container">
        <table class="admin-data-table sub-admins-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Password</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="loading">
              <td colspan="6" class="empty-state-cell">Loading…</td>
            </tr>
            <tr *ngIf="!loading && subAdmins.length === 0">
              <td colspan="6" class="empty-state-cell">No sub admins yet</td>
            </tr>
            <tr *ngFor="let sa of subAdmins">
              <td>{{ sa.full_name }}</td>
              <td class="email-cell">{{ sa.email }}</td>
              <td>
                <span class="status-badge" [class.active]="sa.admin_is_active" [class.inactive]="!sa.admin_is_active">
                  {{ sa.admin_is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <span class="pwd-flag" *ngIf="sa.must_change_password">Must change on login</span>
                <span *ngIf="!sa.must_change_password">—</span>
              </td>
              <td>{{ sa.created_at | date:'mediumDate' }}</td>
              <td class="actions-cell">
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openEditModal(sa)">Edit</button>
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openResetModal(sa)">Reset Password</button>
                <button
                  class="admin-btn admin-btn-sm"
                  [class.admin-btn-danger]="sa.admin_is_active"
                  [class.admin-btn-secondary]="!sa.admin_is_active"
                  (click)="toggleStatus(sa)">
                  {{ sa.admin_is_active ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-content permission-modal" (click)="$event.stopPropagation()">
          <h2>{{ editingId ? 'Edit Sub Admin' : 'Create Sub Admin' }}</h2>

          <div class="form-grid">
            <label>Full Name
              <input class="admin-input" [(ngModel)]="form.full_name" required />
            </label>
            <label>Email
              <input class="admin-input" type="email" [(ngModel)]="form.email" required />
            </label>
            <label>Phone
              <input class="admin-input" [(ngModel)]="form.phone" placeholder="Optional" />
            </label>
            <label *ngIf="!editingId">Initial Password
              <input class="admin-input" type="password" [(ngModel)]="form.password" minlength="8" />
            </label>
          </div>

          <h3 class="matrix-title">Permission Matrix</h3>
          <div class="permission-matrix-wrap">
            <table class="permission-matrix">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>View</th>
                  <th>Create</th>
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of form.permissions">
                  <td class="module-name">{{ formatModule(row.module) }}</td>
                  <td><input type="checkbox" [(ngModel)]="row.can_view" [name]="row.module + '_view'" /></td>
                  <td><input type="checkbox" [(ngModel)]="row.can_create" [name]="row.module + '_create'" [disabled]="!row.can_view" /></td>
                  <td><input type="checkbox" [(ngModel)]="row.can_edit" [name]="row.module + '_edit'" [disabled]="!row.can_view" /></td>
                  <td><input type="checkbox" [(ngModel)]="row.can_delete" [name]="row.module + '_delete'" [disabled]="!row.can_view" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="modal-actions">
            <button class="admin-btn admin-btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="admin-btn admin-btn-primary" [disabled]="saving" (click)="save()">
              {{ saving ? 'Saving…' : (editingId ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showResetModal" (click)="closeResetModal()">
        <div class="modal-content reset-modal" (click)="$event.stopPropagation()">
          <h2>Reset Password</h2>
          <p class="reset-target">Account: <strong>{{ resetTarget?.full_name }}</strong> ({{ resetTarget?.email }})</p>
          <p class="reset-hint">User will be required to change this password on next login.</p>
          <label>New Password
            <input class="admin-input" type="password" [(ngModel)]="resetPassword" minlength="8" />
          </label>
          <label>Confirm Password
            <input class="admin-input" type="password" [(ngModel)]="resetPasswordConfirm" minlength="8" />
          </label>
          <div class="modal-actions">
            <button class="admin-btn admin-btn-secondary" (click)="closeResetModal()">Cancel</button>
            <button class="admin-btn admin-btn-primary" [disabled]="resetting" (click)="confirmReset()">
              {{ resetting ? 'Resetting…' : 'Reset Password' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .section-title { font-size: 18px; margin: 24px 0 12px; color: var(--admin-text, #111827); }
    .sub-admins-table { min-width: 640px; }
    .actions-cell { display: flex; flex-wrap: wrap; gap: 8px; }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-badge.active { background: #D1FAE5; color: #065F46; }
    .status-badge.inactive { background: #FEE2E2; color: #991B1B; }
    .pwd-flag { font-size: 12px; color: #B45309; font-weight: 600; }
    .permission-modal, .reset-modal { max-width: 720px; width: 95vw; }
    .reset-modal label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; font-size: 13px; font-weight: 500; }
    .reset-target { margin: 0 0 8px; font-size: 14px; }
    .reset-hint { margin: 0 0 16px; font-size: 13px; color: var(--admin-text-secondary, #6B7280); }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .form-grid label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
    }
    .matrix-title { margin: 16px 0 8px; font-size: 16px; }
    .permission-matrix-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius);
    }
    .permission-matrix {
      width: 100%;
      min-width: 520px;
      border-collapse: collapse;
    }
    .permission-matrix th,
    .permission-matrix td {
      padding: 10px 12px;
      border-bottom: 1px solid #F3F4F6;
      text-align: center;
      font-size: 13px;
    }
    .permission-matrix th:first-child,
    .permission-matrix td.module-name {
      text-align: left;
      font-weight: 600;
      text-transform: capitalize;
    }
    .permission-matrix thead th {
      background: var(--admin-bg-hover);
      position: sticky;
      top: 0;
    }
    @media (max-width: 768px) {
      .form-grid { grid-template-columns: 1fr; }
      .actions-cell { flex-direction: column; }
      .actions-cell .admin-btn { width: 100%; }
    }
    @media (max-width: 425px) {
      .permission-modal, .reset-modal { width: 100vw; max-height: 95vh; overflow-y: auto; }
      .permission-matrix { min-width: 480px; }
    }
  `]
})
export class AdminSubAdminsComponent implements OnInit {
  subAdmins: SubAdmin[] = [];
  admins: SubAdmin[] = [];
  loading = false;
  loadingAdmins = false;
  saving = false;
  showModal = false;
  showResetModal = false;
  resetting = false;
  editingId: string | null = null;
  resetTarget: SubAdmin | null = null;
  resetPassword = '';
  resetPasswordConfirm = '';

  form = {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    permissions: defaultPermissions()
  };

  constructor(
    private adminService: AdminService,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadAdmins()]);
  }

  async load() {
    this.loading = true;
    try {
      this.subAdmins = await firstValueFrom(this.adminService.getSubAdmins());
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to load sub admins'));
    } finally {
      this.loading = false;
    }
  }

  async loadAdmins() {
    this.loadingAdmins = true;
    try {
      this.admins = await firstValueFrom(this.adminService.getAdmins());
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to load admins'));
    } finally {
      this.loadingAdmins = false;
    }
  }

  formatModule(module: string): string {
    return module.replace(/_/g, ' ');
  }

  openCreateModal() {
    this.editingId = null;
    this.form = {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      permissions: defaultPermissions()
    };
    this.showModal = true;
  }

  openEditModal(sa: SubAdmin) {
    this.editingId = sa.id;
    this.form = {
      full_name: sa.full_name,
      email: sa.email,
      phone: sa.phone || '',
      password: '',
      permissions: sa.permissions?.length ? sa.permissions.map((p) => ({ ...p })) : defaultPermissions()
    };
    this.showModal = true;
  }

  openResetModal(account: SubAdmin) {
    this.resetTarget = account;
    this.resetPassword = '';
    this.resetPasswordConfirm = '';
    this.showResetModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingId = null;
  }

  closeResetModal() {
    this.showResetModal = false;
    this.resetTarget = null;
    this.resetPassword = '';
    this.resetPasswordConfirm = '';
  }

  async save() {
    if (!this.form.full_name.trim() || !this.form.email.trim()) {
      this.toast.error('Name and email are required');
      return;
    }
    if (!this.editingId && (!this.form.password || this.form.password.length < 8)) {
      this.toast.error('Password must be at least 8 characters');
      return;
    }

    this.saving = true;
    try {
      if (this.editingId) {
        await firstValueFrom(
          this.adminService.updateSubAdmin(this.editingId, {
            full_name: this.form.full_name.trim(),
            email: this.form.email.trim(),
            phone: this.form.phone.trim() || undefined,
            permissions: this.form.permissions
          })
        );
        this.toast.success('Sub admin updated');
      } else {
        await firstValueFrom(
          this.adminService.createSubAdmin({
            full_name: this.form.full_name.trim(),
            email: this.form.email.trim(),
            phone: this.form.phone.trim() || undefined,
            password: this.form.password,
            permissions: this.form.permissions
          })
        );
        this.toast.success('Sub admin created');
      }
      this.closeModal();
      await this.load();
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to save sub admin'));
    } finally {
      this.saving = false;
    }
  }

  async confirmReset() {
    if (!this.resetTarget) return;
    if (!this.resetPassword || this.resetPassword.length < 8) {
      this.toast.error('Password must be at least 8 characters');
      return;
    }
    if (this.resetPassword !== this.resetPasswordConfirm) {
      this.toast.error('Password confirmation must match');
      return;
    }

    this.resetting = true;
    try {
      await firstValueFrom(this.adminService.resetUserPassword(this.resetTarget.id, this.resetPassword));
      this.toast.success('Password reset successfully');
      this.closeResetModal();
      await Promise.all([this.load(), this.loadAdmins()]);
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to reset password'));
    } finally {
      this.resetting = false;
    }
  }

  async toggleStatus(sa: SubAdmin) {
    try {
      await firstValueFrom(this.adminService.updateSubAdminStatus(sa.id, !sa.admin_is_active));
      this.toast.success(sa.admin_is_active ? 'Sub admin deactivated' : 'Sub admin activated');
      await this.load();
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to update status'));
    }
  }
}
