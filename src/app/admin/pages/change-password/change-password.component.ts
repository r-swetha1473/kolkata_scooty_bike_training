import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';

@Component({
  selector: 'app-admin-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="change-password-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Change Password</h1>
      </div>

      <div class="password-banner" *ngIf="auth.getUserProfile()?.must_change_password">
        You must change your password before accessing the admin dashboard.
      </div>

      <div class="password-card">
        <form (ngSubmit)="onSubmit()" class="password-form" novalidate>
          <div class="form-group">
            <label for="current">Current Password</label>
            <input
              id="current"
              type="password"
              class="admin-input"
              [(ngModel)]="form.current_password"
              name="current_password"
              autocomplete="current-password"
              required
              [disabled]="saving" />
          </div>

          <div class="form-group">
            <label for="new">New Password</label>
            <input
              id="new"
              type="password"
              class="admin-input"
              [(ngModel)]="form.new_password"
              name="new_password"
              autocomplete="new-password"
              minlength="8"
              required
              [disabled]="saving" />
            <span class="hint">Minimum 8 characters</span>
          </div>

          <div class="form-group">
            <label for="confirm">Confirm Password</label>
            <input
              id="confirm"
              type="password"
              class="admin-input"
              [(ngModel)]="form.confirm_password"
              name="confirm_password"
              autocomplete="new-password"
              required
              [disabled]="saving" />
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="admin-btn admin-btn-secondary"
              *ngIf="!auth.getUserProfile()?.must_change_password"
              (click)="goBack()"
              [disabled]="saving">
              Cancel
            </button>
            <button type="submit" class="admin-btn admin-btn-primary" [disabled]="saving || !isFormValid()">
              {{ saving ? 'Saving…' : 'Update Password' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .change-password-page {
      max-width: 520px;
      margin: 0 auto;
      width: 100%;
    }

    .password-banner {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FCD34D;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 14px;
      font-weight: 500;
    }

    .password-card {
      background: #fff;
      border: 1px solid var(--admin-border, #E5E7EB);
      border-radius: 10px;
      padding: 24px;
      box-shadow: var(--admin-shadow-sm, 0 1px 2px rgba(0,0,0,0.04));
    }

    .password-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 600;
      color: var(--admin-text, #111827);
    }

    .hint {
      font-size: 12px;
      color: var(--admin-text-muted, #9CA3AF);
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
    }

    @media (max-width: 768px) {
      .password-card {
        padding: 16px;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .form-actions .admin-btn {
        width: 100%;
      }
    }

    @media (max-width: 425px) {
      .change-password-page {
        padding: 0 4px;
      }

      .admin-page-title {
        font-size: 20px;
      }
    }
  `]
})
export class AdminChangePasswordComponent {
  form = {
    current_password: '',
    new_password: '',
    confirm_password: ''
  };
  saving = false;

  constructor(
    public auth: AuthService,
    private adminService: AdminService,
    private toast: ToastService,
    private router: Router
  ) {}

  isFormValid(): boolean {
    return !!(
      this.form.current_password &&
      this.form.new_password.length >= 8 &&
      this.form.confirm_password &&
      this.form.new_password === this.form.confirm_password
    );
  }

  async onSubmit() {
    if (!this.isFormValid()) {
      if (this.form.new_password !== this.form.confirm_password) {
        this.toast.error('Password confirmation must match');
      } else if (this.form.new_password.length < 8) {
        this.toast.error('New password must be at least 8 characters');
      }
      return;
    }

    this.saving = true;
    try {
      await firstValueFrom(
        this.adminService.changePassword({
          current_password: this.form.current_password,
          new_password: this.form.new_password,
          confirm_password: this.form.confirm_password
        })
      );

      this.auth.clearMustChangePassword();
      this.auth.reloadUserProfile();

      this.form = { current_password: '', new_password: '', confirm_password: '' };
      this.toast.success('Password updated successfully');
      this.router.navigate(['/admin']);
    } catch (err) {
      this.toast.error(getApiErrorMessage(err, 'Failed to change password'));
    } finally {
      this.saving = false;
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}
