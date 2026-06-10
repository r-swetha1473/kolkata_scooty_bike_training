import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminService, SubAdmin } from '../../../services/admin.service';
import { ModulePermission } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';

const MODULES = ['dashboard', 'users', 'trainers', 'vehicles', 'bookings', 'slots', 'audit_logs', 'settings'];

type AccountRole = 'admin' | 'subadmin';
type FormField = 'full_name' | 'email' | 'phone' | 'password' | 'confirm_password';

function defaultPermissions(): ModulePermission[] {
  return MODULES.map((module) => ({
    module,
    can_view: true,
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
          <button class="admin-btn admin-btn-primary" (click)="openCreateModal()">Create Account</button>
        </div>
      </div>

      <h2 class="section-title">Admins</h2>
      <div class="admin-table-container">
        <table class="admin-data-table sub-admins-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="loadingAdmins">
              <td colspan="6" class="empty-state-cell">Loading…</td>
            </tr>
            <tr *ngIf="!loadingAdmins && admins.length === 0">
              <td colspan="6" class="empty-state-cell">No admin accounts</td>
            </tr>
            <tr *ngFor="let admin of admins">
              <td>{{ admin.full_name }}</td>
              <td class="email-cell">{{ admin.email }}</td>
              <td>{{ admin.phone || '—' }}</td>
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
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openEditModal(admin, 'admin')">Edit</button>
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openResetModal(admin)">Reset Password</button>
                <button class="admin-btn admin-btn-danger admin-btn-sm" (click)="openDeleteModal(admin, 'admin')">Delete</button>
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
              <th>Phone</th>
              <th>Status</th>
              <th>Password</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="loading">
              <td colspan="7" class="empty-state-cell">Loading…</td>
            </tr>
            <tr *ngIf="!loading && subAdmins.length === 0">
              <td colspan="7" class="empty-state-cell">No sub admins yet</td>
            </tr>
            <tr *ngFor="let sa of subAdmins">
              <td>{{ sa.full_name }}</td>
              <td class="email-cell">{{ sa.email }}</td>
              <td>{{ sa.phone || '—' }}</td>
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
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openEditModal(sa, 'subadmin')">Edit</button>
                <button class="admin-btn admin-btn-secondary admin-btn-sm" (click)="openResetModal(sa)">Reset Password</button>
                <button class="admin-btn admin-btn-danger admin-btn-sm" (click)="openDeleteModal(sa, 'subadmin')">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Create / Edit modal (shared) -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div
          #accountModalPanel
          class="modal-content account-modal"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'account-modal-title'"
          tabindex="-1">
          <div class="modal-header">
            <h2 id="account-modal-title">{{ editingId ? 'Edit Account' : 'Create Account' }}</h2>
            <button type="button" class="modal-close-btn" (click)="closeModal()" aria-label="Close dialog">×</button>
          </div>

          <div class="modal-body">
            <div class="account-form">
              <div class="form-row">
                <div class="form-field" [class.field-invalid]="showFieldError('full_name')">
                  <label class="field-label" for="account-full-name">Name <span class="required">*</span></label>
                  <input
                    id="account-full-name"
                    class="admin-input"
                    [(ngModel)]="form.full_name"
                    (blur)="markTouched('full_name')"
                    autocomplete="name" />
                  <span class="field-error" *ngIf="showFieldError('full_name')">Name is required</span>
                </div>
                <div class="form-field" [class.field-invalid]="showFieldError('email')">
                  <label class="field-label" for="account-email">Email <span class="required">*</span></label>
                  <input
                    id="account-email"
                    class="admin-input"
                    type="email"
                    [(ngModel)]="form.email"
                    (blur)="markTouched('email')"
                    autocomplete="email" />
                  <span class="field-error" *ngIf="showFieldError('email')">
                    {{ !form.email.trim() ? 'Email is required' : 'Enter a valid email address' }}
                  </span>
                </div>
              </div>

              <div class="form-row">
                <div class="form-field" [class.field-invalid]="showFieldError('phone')">
                  <label class="field-label" for="account-phone">Phone Number</label>
                  <input
                    id="account-phone"
                    class="admin-input"
                    [(ngModel)]="form.phone"
                    (blur)="markTouched('phone')"
                    placeholder="10-digit mobile"
                    maxlength="10"
                    inputmode="numeric" />
                  <span class="field-error" *ngIf="showFieldError('phone')">Phone must be exactly 10 digits</span>
                </div>
                <div class="form-field">
                  <label class="field-label" for="account-role">Role <span class="required" *ngIf="!editingId">*</span></label>
                  <select
                    *ngIf="!editingId"
                    id="account-role"
                    class="admin-input"
                    [(ngModel)]="form.role"
                    (ngModelChange)="onRoleChange()">
                    <option value="admin">Admin</option>
                    <option value="subadmin">Sub Admin</option>
                  </select>
                  <input
                    *ngIf="editingId"
                    id="account-role"
                    class="admin-input"
                    [value]="form.role === 'subadmin' ? 'Sub Admin' : 'Admin'"
                    disabled />
                </div>
              </div>

              <div class="form-row form-row-full">
                <div class="form-field">
                  <label class="field-label" for="account-status">Status</label>
                  <select id="account-status" class="admin-input" [(ngModel)]="form.status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div class="form-row" *ngIf="!editingId">
                <div class="form-field" [class.field-invalid]="showFieldError('password')">
                  <label class="field-label" for="account-password">Password <span class="required">*</span></label>
                  <input
                    id="account-password"
                    class="admin-input"
                    type="password"
                    [(ngModel)]="form.password"
                    (blur)="markTouched('password')"
                    minlength="8"
                    autocomplete="new-password" />
                  <span class="field-error" *ngIf="showFieldError('password')">Password must be at least 8 characters</span>
                </div>
                <div class="form-field" [class.field-invalid]="showFieldError('confirm_password')">
                  <label class="field-label" for="account-confirm-password">Confirm Password <span class="required">*</span></label>
                  <input
                    id="account-confirm-password"
                    class="admin-input"
                    type="password"
                    [(ngModel)]="form.confirm_password"
                    (blur)="markTouched('confirm_password')"
                    minlength="8"
                    autocomplete="new-password" />
                  <span class="field-error" *ngIf="showFieldError('confirm_password')">Passwords must match</span>
                </div>
              </div>
            </div>

            <div class="permission-section" *ngIf="form.role === 'subadmin'" aria-labelledby="permission-matrix-title">
              <h3 id="permission-matrix-title" class="matrix-title">Permission Matrix</h3>
              <p class="matrix-hint">Scroll horizontally on small screens to view all permission columns.</p>
              <div class="permission-matrix-wrap" tabindex="0" role="region" aria-label="Module permissions">
                <table class="permission-matrix">
                  <thead>
                    <tr>
                      <th scope="col">Module</th>
                      <th scope="col">View</th>
                      <th scope="col">Create</th>
                      <th scope="col">Edit</th>
                      <th scope="col">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of form.permissions">
                      <td class="module-name">{{ formatModule(row.module) }}</td>
                      <td>
                        <label class="perm-check" [attr.aria-label]="formatModule(row.module) + ' view'">
                          <input type="checkbox" [(ngModel)]="row.can_view" [name]="row.module + '_view'" />
                        </label>
                      </td>
                      <td>
                        <label class="perm-check" [attr.aria-label]="formatModule(row.module) + ' create'">
                          <input type="checkbox" [(ngModel)]="row.can_create" [name]="row.module + '_create'" [disabled]="!row.can_view" />
                        </label>
                      </td>
                      <td>
                        <label class="perm-check" [attr.aria-label]="formatModule(row.module) + ' edit'">
                          <input type="checkbox" [(ngModel)]="row.can_edit" [name]="row.module + '_edit'" [disabled]="!row.can_view" />
                        </label>
                      </td>
                      <td>
                        <label class="perm-check" [attr.aria-label]="formatModule(row.module) + ' delete'">
                          <input type="checkbox" [(ngModel)]="row.can_delete" [name]="row.module + '_delete'" [disabled]="!row.can_view" />
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary modal-action-btn" (click)="closeModal()">Cancel</button>
            <button
              type="button"
              class="admin-btn admin-btn-primary modal-action-btn"
              [disabled]="saving || !isFormValid"
              (click)="save()">
              {{ saving ? 'Saving…' : (editingId ? 'Update' : 'Create') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Reset password modal -->
      <div class="modal-overlay" *ngIf="showResetModal" (click)="closeResetModal()">
        <div
          #resetModalPanel
          class="modal-content compact-modal"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          aria-describedby="reset-modal-hint"
          tabindex="-1">
          <div class="modal-header">
            <h2 id="reset-modal-title">Reset Password</h2>
            <button type="button" class="modal-close-btn" (click)="closeResetModal()" aria-label="Close dialog">×</button>
          </div>
          <div class="modal-body">
            <p class="modal-lead reset-target">
              Account: <strong>{{ resetTarget?.full_name }}</strong>
              <span class="modal-meta">({{ resetTarget?.email }})</span>
            </p>
            <p id="reset-modal-hint" class="modal-hint reset-hint">User will be required to change this password on next login.</p>
            <div class="account-form compact-form">
              <div class="form-field">
                <label class="field-label" for="reset-password">New Password <span class="required">*</span></label>
                <input
                  id="reset-password"
                  class="admin-input"
                  type="password"
                  [(ngModel)]="resetPassword"
                  minlength="8"
                  autocomplete="new-password" />
              </div>
              <div class="form-field">
                <label class="field-label" for="reset-password-confirm">Confirm Password <span class="required">*</span></label>
                <input
                  id="reset-password-confirm"
                  class="admin-input"
                  type="password"
                  [(ngModel)]="resetPasswordConfirm"
                  minlength="8"
                  autocomplete="new-password" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary modal-action-btn" (click)="closeResetModal()">Cancel</button>
            <button type="button" class="admin-btn admin-btn-primary modal-action-btn" [disabled]="resetting" (click)="confirmReset()">
              {{ resetting ? 'Resetting…' : 'Reset Password' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete confirmation modal -->
      <div class="modal-overlay" *ngIf="showDeleteModal" (click)="closeDeleteModal()">
        <div
          #deleteModalPanel
          class="modal-content compact-modal danger-modal"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-hint"
          tabindex="-1">
          <div class="modal-header">
            <h2 id="delete-modal-title">Delete Account</h2>
            <button type="button" class="modal-close-btn" (click)="closeDeleteModal()" aria-label="Close dialog">×</button>
          </div>
          <div class="modal-body">
            <p class="modal-lead delete-warning">
              Are you sure you want to delete <strong>{{ deleteTarget?.full_name }}</strong>?
              <span class="modal-meta">({{ deleteTarget?.email }})</span>
            </p>
            <p id="delete-modal-hint" class="modal-hint delete-hint">This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary modal-action-btn" (click)="closeDeleteModal()">Cancel</button>
            <button type="button" class="admin-btn admin-btn-danger modal-action-btn" [disabled]="deleting" (click)="confirmDelete()">
              {{ deleting ? 'Deleting…' : 'Delete' }}
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
    .account-modal,
    .compact-modal {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;
      margin: 0 auto;
      max-height: 90vh;
    }
    .account-modal {
      max-width: 900px;
      width: min(900px, 95vw);
    }
    .compact-modal {
      max-width: 480px;
      width: min(480px, 95vw);
    }
    .modal-header {
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--admin-border, #E5E7EB);
      background: #fff;
    }
    .modal-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--admin-text, #111827);
    }
    .modal-close-btn {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--admin-text-secondary, #6B7280);
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .modal-close-btn:hover {
      background: var(--admin-bg-hover, #F3F4F6);
      color: var(--admin-text, #111827);
    }
    .modal-close-btn:focus-visible {
      outline: 2px solid var(--admin-primary, #0066B1);
      outline-offset: 2px;
    }
    .modal-body {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px 24px 8px;
      min-height: 0;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    .modal-footer {
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid var(--admin-border, #E5E7EB);
      background: #fff;
      box-shadow: 0 -4px 12px rgba(17, 24, 39, 0.04);
    }
    .modal-action-btn {
      min-width: 108px;
      min-height: 40px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
    }
    .modal-lead {
      margin: 0 0 8px;
      font-size: 15px;
      line-height: 1.5;
      color: var(--admin-text, #111827);
    }
    .modal-meta {
      display: inline-block;
      color: var(--admin-text-secondary, #6B7280);
      font-size: 14px;
      word-break: break-word;
    }
    .modal-hint {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--admin-text-secondary, #6B7280);
    }
    .compact-form {
      gap: 14px;
    }
    .danger-modal .modal-header h2 {
      color: #B91C1C;
    }
    .delete-hint {
      color: #B91C1C;
      font-weight: 600;
      margin-bottom: 0;
    }
    .account-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 0;
    }
    .form-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }
    .form-row-full {
      grid-template-columns: 1fr;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .form-field .field-error {
      min-height: 14px;
    }
    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--admin-text, #111827);
      line-height: 1.3;
    }
    .required {
      color: #DC2626;
    }
    .form-field .admin-input {
      width: 100%;
      box-sizing: border-box;
    }
    .field-invalid .admin-input {
      border-color: #DC2626;
      box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
    }
    .field-error {
      font-size: 11px;
      color: #DC2626;
      line-height: 1.3;
    }
    .permission-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--admin-border, #E5E7EB);
    }
    .matrix-title {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 600;
      color: var(--admin-text, #111827);
    }
    .matrix-hint {
      display: none;
      margin: 0 0 10px;
      font-size: 12px;
      color: var(--admin-text-secondary, #6B7280);
      line-height: 1.4;
    }
    .permission-matrix-wrap {
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      border: 1px solid var(--admin-border, #E5E7EB);
      border-radius: var(--admin-radius, 8px);
      max-height: min(280px, 40vh);
      scroll-behavior: smooth;
    }
    .permission-matrix {
      width: 100%;
      min-width: 480px;
      border-collapse: collapse;
    }
    .permission-matrix th,
    .permission-matrix td {
      padding: 8px 12px;
      border-bottom: 1px solid #F3F4F6;
      text-align: center;
      font-size: 12px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .permission-matrix td:not(.module-name) {
      width: 72px;
    }
    .permission-matrix th:first-child,
    .permission-matrix td.module-name {
      text-align: left;
      font-weight: 600;
      text-transform: capitalize;
      min-width: 100px;
    }
    .permission-matrix thead th {
      background: var(--admin-bg-hover, #F9FAFB);
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--admin-text-secondary, #6B7280);
    }
    .perm-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      cursor: pointer;
    }
    .perm-check input[type="checkbox"] {
      width: 15px;
      height: 15px;
      margin: 0;
      cursor: pointer;
      accent-color: var(--admin-primary, #0066B1);
    }
    .perm-check input[type="checkbox"]:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(17, 24, 39, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      overflow: hidden;
    }
    .modal-content {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      width: 100%;
    }
    @media (min-width: 1024px) {
      .permission-matrix-wrap {
        max-height: min(320px, 42vh);
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .account-modal {
        width: min(900px, 92vw);
      }
      .form-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 767px) {
      .matrix-hint { display: block; }
      .form-row { grid-template-columns: 1fr; }
      .actions-cell { flex-direction: column; }
      .actions-cell .admin-btn { width: 100%; }
      .modal-header,
      .modal-body,
      .modal-footer {
        padding-left: 16px;
        padding-right: 16px;
      }
      .permission-matrix-wrap {
        max-height: min(200px, 30vh);
      }
    }
    @media (max-width: 425px) {
      .account-modal,
      .compact-modal {
        width: 100%;
        max-height: 92vh;
        border-radius: 10px;
      }
      .permission-matrix { min-width: 400px; }
      .matrix-hint { display: block; }
      .modal-footer {
        flex-wrap: wrap;
      }
      .modal-footer .modal-action-btn {
        flex: 1 1 calc(50% - 6px);
        min-width: 120px;
      }
    }
    @media (max-width: 375px) {
      .modal-header,
      .modal-body,
      .modal-footer {
        padding-left: 14px;
        padding-right: 14px;
      }
      .permission-matrix-wrap {
        max-height: min(220px, 32vh);
      }
    }
    @media (max-width: 320px) {
      .modal-overlay { padding: 8px; }
      .account-modal,
      .compact-modal {
        border-radius: 8px;
        max-height: 94vh;
      }
      .modal-header h2 { font-size: 16px; }
      .modal-footer {
        flex-direction: column-reverse;
        align-items: stretch;
        gap: 8px;
      }
      .modal-footer .modal-action-btn {
        width: 100%;
        min-width: 0;
      }
      .matrix-hint { font-size: 11px; }
    }
  `]
})
export class AdminSubAdminsComponent implements OnInit, OnDestroy {
  @ViewChild('accountModalPanel') accountModalPanel?: ElementRef<HTMLElement>;
  @ViewChild('resetModalPanel') resetModalPanel?: ElementRef<HTMLElement>;
  @ViewChild('deleteModalPanel') deleteModalPanel?: ElementRef<HTMLElement>;

  subAdmins: SubAdmin[] = [];
  admins: SubAdmin[] = [];
  loading = false;
  loadingAdmins = false;
  saving = false;
  deleting = false;
  showModal = false;
  showResetModal = false;
  showDeleteModal = false;
  resetting = false;
  editingId: string | null = null;
  editingRole: AccountRole | null = null;
  resetTarget: SubAdmin | null = null;
  deleteTarget: SubAdmin | null = null;
  deleteRole: AccountRole | null = null;
  resetPassword = '';
  resetPasswordConfirm = '';
  private touchedFields = new Set<FormField>();

  form = {
    full_name: '',
    email: '',
    phone: '',
    role: 'subadmin' as AccountRole,
    password: '',
    confirm_password: '',
    status: 'active' as 'active' | 'inactive',
    permissions: defaultPermissions()
  };

  constructor(
    private adminService: AdminService,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadAdmins()]);
  }

  ngOnDestroy() {
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown', ['$event'])
  handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showModal) {
        event.preventDefault();
        this.closeModal();
      } else if (this.showResetModal) {
        event.preventDefault();
        this.closeResetModal();
      } else if (this.showDeleteModal) {
        event.preventDefault();
        this.closeDeleteModal();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = this.getActiveModalPanel();
    if (!panel) return;
    this.trapFocusInModal(event, panel);
  }

  private getActiveModalPanel(): HTMLElement | undefined {
    if (this.showModal) return this.accountModalPanel?.nativeElement;
    if (this.showResetModal) return this.resetModalPanel?.nativeElement;
    if (this.showDeleteModal) return this.deleteModalPanel?.nativeElement;
    return undefined;
  }

  private trapFocusInModal(event: KeyboardEvent, root?: HTMLElement) {
    if (!root) return;
    const selector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private syncBodyScrollLock() {
    const locked = this.showModal || this.showResetModal || this.showDeleteModal;
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  private unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  private focusActiveModal(preferSelector?: string) {
    setTimeout(() => {
      const panel = this.getActiveModalPanel();
      if (!panel) return;
      const preferred = preferSelector ? panel.querySelector<HTMLElement>(preferSelector) : null;
      const first =
        preferred ??
        panel.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button.modal-close-btn');
      (first ?? panel).focus();
    });
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

  get isFormValid(): boolean {
    if (!this.form.full_name.trim()) return false;
    if (!this.form.email.trim() || !this.isEmailValid(this.form.email)) return false;
    if (this.form.phone.trim() && !/^[0-9]{10}$/.test(this.form.phone.trim())) return false;
    if (!this.editingId) {
      if (!this.form.password || this.form.password.length < 8) return false;
      if (this.form.password !== this.form.confirm_password) return false;
    }
    return true;
  }

  markTouched(field: FormField) {
    this.touchedFields.add(field);
  }

  private resetTouched() {
    this.touchedFields.clear();
  }

  private touchAllFields() {
    this.touchedFields.add('full_name');
    this.touchedFields.add('email');
    this.touchedFields.add('phone');
    if (!this.editingId) {
      this.touchedFields.add('password');
      this.touchedFields.add('confirm_password');
    }
  }

  showFieldError(field: FormField): boolean {
    if (!this.touchedFields.has(field)) return false;
    return this.isFieldInvalid(field);
  }

  private isFieldInvalid(field: FormField): boolean {
    switch (field) {
      case 'full_name':
        return !this.form.full_name.trim();
      case 'email':
        return !this.form.email.trim() || !this.isEmailValid(this.form.email);
      case 'phone':
        return !!this.form.phone.trim() && !/^[0-9]{10}$/.test(this.form.phone.trim());
      case 'password':
        return !this.editingId && (!this.form.password || this.form.password.length < 8);
      case 'confirm_password':
        return !this.editingId && this.form.password !== this.form.confirm_password;
      default:
        return false;
    }
  }

  private isEmailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  onRoleChange() {
    if (this.form.role === 'subadmin' && !this.editingId) {
      this.form.permissions = defaultPermissions();
    }
  }

  openCreateModal() {
    this.resetTouched();
    this.editingId = null;
    this.editingRole = null;
    this.form = {
      full_name: '',
      email: '',
      phone: '',
      role: 'subadmin',
      password: '',
      confirm_password: '',
      status: 'active',
      permissions: defaultPermissions()
    };
    this.showModal = true;
    this.syncBodyScrollLock();
    this.focusActiveModal('#account-full-name');
  }

  openEditModal(account: SubAdmin, role: AccountRole) {
    this.resetTouched();
    this.editingId = account.id;
    this.editingRole = role;
    this.form = {
      full_name: account.full_name,
      email: account.email,
      phone: account.phone || '',
      role,
      password: '',
      confirm_password: '',
      status: account.admin_is_active ? 'active' : 'inactive',
      permissions: account.permissions?.length
        ? account.permissions.map((p) => ({ ...p }))
        : defaultPermissions()
    };
    this.showModal = true;
    this.syncBodyScrollLock();
    this.focusActiveModal('#account-full-name');
  }

  openResetModal(account: SubAdmin) {
    this.resetTarget = account;
    this.resetPassword = '';
    this.resetPasswordConfirm = '';
    this.showResetModal = true;
    this.syncBodyScrollLock();
    this.focusActiveModal('#reset-password');
  }

  openDeleteModal(account: SubAdmin, role: AccountRole) {
    this.deleteTarget = account;
    this.deleteRole = role;
    this.showDeleteModal = true;
    this.syncBodyScrollLock();
    this.focusActiveModal('.modal-footer .admin-btn-secondary');
  }

  closeModal() {
    this.showModal = false;
    this.editingId = null;
    this.editingRole = null;
    this.resetTouched();
    this.syncBodyScrollLock();
  }

  closeResetModal() {
    this.showResetModal = false;
    this.resetTarget = null;
    this.resetPassword = '';
    this.resetPasswordConfirm = '';
    this.syncBodyScrollLock();
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteTarget = null;
    this.deleteRole = null;
    this.syncBodyScrollLock();
  }

  private isActive(): boolean {
    return this.form.status === 'active';
  }

  async save() {
    this.touchAllFields();
    if (!this.isFormValid) {
      this.toast.error('Please fix the highlighted fields');
      return;
    }

    this.saving = true;
    try {
      const phone = this.form.phone.trim() || undefined;
      const adminIsActive = this.isActive();

      if (this.editingId && this.editingRole) {
        if (this.editingRole === 'subadmin') {
          await firstValueFrom(
            this.adminService.updateSubAdmin(this.editingId, {
              full_name: this.form.full_name.trim(),
              email: this.form.email.trim(),
              phone,
              admin_is_active: adminIsActive,
              permissions: this.form.permissions
            })
          );
          this.toast.success('Sub admin updated');
          await this.load();
        } else {
          await firstValueFrom(
            this.adminService.updateAdmin(this.editingId, {
              full_name: this.form.full_name.trim(),
              email: this.form.email.trim(),
              phone,
              admin_is_active: adminIsActive
            })
          );
          this.toast.success('Admin updated');
          await this.loadAdmins();
        }
      } else if (this.form.role === 'subadmin') {
        await firstValueFrom(
          this.adminService.createSubAdmin({
            full_name: this.form.full_name.trim(),
            email: this.form.email.trim(),
            phone,
            password: this.form.password,
            confirm_password: this.form.confirm_password,
            admin_is_active: adminIsActive,
            permissions: this.form.permissions
          })
        );
        this.toast.success('Sub admin created');
        await this.load();
      } else {
        await firstValueFrom(
          this.adminService.createAdmin({
            full_name: this.form.full_name.trim(),
            email: this.form.email.trim(),
            phone,
            password: this.form.password,
            confirm_password: this.form.confirm_password,
            admin_is_active: adminIsActive
          })
        );
        this.toast.success('Admin created');
        await this.loadAdmins();
      }

      this.closeModal();
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to save account'));
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

  async confirmDelete() {
    if (!this.deleteTarget || !this.deleteRole) return;

    this.deleting = true;
    try {
      if (this.deleteRole === 'subadmin') {
        await firstValueFrom(this.adminService.deleteSubAdmin(this.deleteTarget.id));
        this.toast.success('Sub admin deleted');
        await this.load();
      } else {
        await firstValueFrom(this.adminService.deleteAdmin(this.deleteTarget.id));
        this.toast.success('Admin deleted');
        await this.loadAdmins();
      }
      this.closeDeleteModal();
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to delete account'));
    } finally {
      this.deleting = false;
    }
  }
}
