import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';
import { HttpService } from '../../services/http.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="profile-page">
      <div *ngIf="loading && !userProfile" class="loading">Loading profile…</div>

      <div *ngIf="showInactiveBanner" class="banner-inactive" role="alert">
        <p class="banner-text">Your account is inactive. Contact admin.</p>
        <button
          *ngIf="userProfile?.inactive_blocked"
          type="button"
          class="btn-reactivation"
          (click)="openReactivationModal()"
          [disabled]="reactivationSubmitting || reactivationStatus?.status === 'pending'">
          {{ reactivationStatus?.status === 'pending' ? 'Request Pending' : 'Request Account Reactivation' }}
        </button>
        <p *ngIf="reactivationStatus" class="reactivation-status" [class]="'status-' + reactivationStatus.status">
          Request status: {{ reactivationStatus.status_label }}
        </p>
        <p *ngIf="reactivationStatus?.user_message" class="reactivation-message">
          {{ reactivationStatus.user_message }}
        </p>
      </div>

      <div class="profile-card" *ngIf="userProfile">
        <div class="profile-header">
          <div class="avatar-wrap">
            <img
              *ngIf="userProfile.avatar_url"
              [src]="userProfile.avatar_url"
              [alt]="userProfile.full_name"
              class="avatar-img" />
            <div *ngIf="!userProfile.avatar_url" class="avatar-placeholder">
              {{ getInitials(userProfile.full_name) }}
            </div>
          </div>
          <div class="profile-fields">
            <h1 class="name">{{ userProfile.full_name || 'User' }}</h1>
            <div class="field"><span class="k">Email</span> {{ userProfile.email }}</div>
            <div class="field">
              <span class="k">Phone</span>
              <ng-container *ngIf="!isPlaceholderPhone(userProfile.phone); else phPlaceholder">
                {{ displayPhoneLabel(userProfile.phone!) }}
              </ng-container>
              <ng-template #phPlaceholder>
                <span class="muted">Not saved yet</span>
              </ng-template>
            </div>
            <div class="field">
              <span class="k">Status</span>
              <span [class.inactive-label]="userProfile.inactive_blocked === true">
                {{ accountStatusLabel() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-card" *ngIf="userProfile">
        <h2 class="card-title">Mobile number</h2>
        <p class="hint" *ngIf="isPlaceholderPhone(userProfile.phone)">
          Add your 10-digit mobile for bookings and confirmations.
        </p>
        <div class="form-group">
          <label for="profilePhone">Mobile</label>
          <input
            id="profilePhone"
            type="tel"
            maxlength="10"
            inputmode="numeric"
            autocomplete="tel"
            [(ngModel)]="phoneEditValue"
            (ngModelChange)="phoneUpdateSuccess = ''; phoneUpdateError = ''"
            placeholder="9876543210"
            class="phone-input" />
        </div>
        <button
          type="button"
          class="btn-save"
          (click)="saveMobileNumber()"
          [disabled]="savingPhone || !isPhoneInputValid()">
          {{ savingPhone ? 'Saving…' : 'Save mobile number' }}
        </button>
        <p class="ok" *ngIf="phoneUpdateSuccess">{{ phoneUpdateSuccess }}</p>
        <p class="err" *ngIf="phoneUpdateError">{{ phoneUpdateError }}</p>
        <p class="nav-bookings">
          <a routerLink="/my-bookings">View my bookings →</a>
        </p>
      </div>

      <div class="modal-overlay" *ngIf="showReactivationModal" (click)="closeReactivationModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <button type="button" class="close-btn" (click)="closeReactivationModal()" aria-label="Close">×</button>
          <h2>Request Account Reactivation</h2>
          <p class="modal-subtitle">
            Your account is currently inactive.
            Do you want to send a reactivation request to the administrator?
          </p>
          <p class="err" *ngIf="reactivationError">{{ reactivationError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" (click)="closeReactivationModal()">Cancel</button>
            <button
              type="button"
              class="btn-save"
              (click)="submitReactivationRequest()"
              [disabled]="reactivationSubmitting">
              {{ reactivationSubmitting ? 'Sending…' : 'Send Request' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .profile-page {
        max-width: 640px;
        margin: 0 auto;
        padding: 24px;
      }
      .loading {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
      }
      .banner-inactive {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 14px 18px;
        border-radius: 10px;
        margin-bottom: 20px;
      }
      .banner-text {
        margin: 0 0 12px 0;
        font-weight: 600;
      }
      .btn-reactivation {
        padding: 10px 16px;
        background: #991b1b;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        min-height: 44px;
      }
      .btn-reactivation:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .reactivation-status {
        margin: 12px 0 0;
        font-size: 14px;
        font-weight: 600;
      }
      .status-pending { color: #b45309; }
      .status-approved { color: #059669; }
      .status-rejected { color: #991b1b; }
      .reactivation-message {
        margin: 8px 0 0;
        font-size: 14px;
        color: #7f1d1d;
      }
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 16px;
      }
      .modal-content {
        background: var(--bg-primary);
        border-radius: 12px;
        padding: 24px;
        width: min(440px, 100%);
        position: relative;
        box-shadow: var(--shadow-lg, 0 12px 40px rgba(0, 0, 0, 0.2));
      }
      .modal-content h2 {
        margin: 0 0 8px;
        font-size: 22px;
      }
      .modal-subtitle {
        margin: 0 0 16px;
        color: var(--text-secondary);
        line-height: 1.5;
      }
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        border: none;
        background: transparent;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-secondary);
      }
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .btn-cancel {
        padding: 10px 16px;
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        background: var(--bg-secondary);
        cursor: pointer;
        min-height: 44px;
      }
      .profile-card {
        background: var(--bg-primary);
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        padding: 28px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm);
      }
      .profile-header {
        display: flex;
        gap: 24px;
        align-items: flex-start;
      }
      .avatar-wrap {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--bg-tertiary);
        flex-shrink: 0;
      }
      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 700;
        color: var(--bmw-primary);
      }
      .name {
        margin: 0 0 16px 0;
        font-size: 26px;
        color: var(--text-primary);
      }
      .field {
        margin-bottom: 10px;
        font-size: 15px;
        color: var(--text-primary);
      }
      .k {
        display: inline-block;
        min-width: 72px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .muted {
        color: var(--text-muted, #6b7280);
      }
      .inactive-label {
        color: #b91c1c;
        font-weight: 600;
      }
      .card-title {
        margin: 0 0 12px 0;
        font-size: 18px;
      }
      .hint {
        color: var(--text-secondary);
        font-size: 14px;
        margin: 0 0 16px 0;
      }
      .form-group {
        margin-bottom: 12px;
      }
      .form-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 6px;
        font-size: 14px;
      }
      .phone-input {
        width: 100%;
        max-width: 280px;
        padding: 10px 12px;
        border: 2px solid var(--border-primary);
        border-radius: 8px;
        font-size: 16px;
      }
      .btn-save {
        padding: 10px 18px;
        background: var(--bmw-primary);
        color: var(--text-on-blue);
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-save:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ok {
        color: #059669;
        font-size: 14px;
        margin-top: 10px;
      }
      .err {
        color: var(--status-error, #dc2626);
        font-size: 14px;
        margin-top: 10px;
      }
      .nav-bookings {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--border-primary);
      }
      .nav-bookings a {
        color: var(--bmw-primary);
        font-weight: 600;
        text-decoration: none;
      }
      @media (max-width: 600px) {
        .profile-header {
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .k {
          min-width: 0;
        }
        .modal-actions {
          flex-direction: column-reverse;
        }
        .modal-actions button {
          width: 100%;
        }
      }
    `
  ]
})
export class ProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  loading = false;
  phoneEditValue = '';
  savingPhone = false;
  phoneUpdateSuccess = '';
  phoneUpdateError = '';
  showInactiveBanner = false;
  showReactivationModal = false;
  reactivationSubmitting = false;
  reactivationError = '';
  reactivationStatus: {
    status: string;
    status_label: string;
    user_message?: string;
  } | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private httpService: HttpService
  ) {}

  async ngOnInit() {
    this.loading = true;
    try {
      if (this.route.snapshot.queryParamMap.get('oauth') === 'success') {
        this.authService.reloadUserProfile();
      }
      this.showInactiveBanner =
        this.route.snapshot.queryParamMap.get('inactive') === '1';

      this.userProfile = this.authService.getUserProfile();
      if (!this.userProfile) {
        try {
          const profile = await firstValueFrom(this.httpService.get<UserProfile>('/auth/me'));
          if (profile) {
            this.userProfile = profile;
            (this.authService as any).userProfileSubject.next(profile);
          }
        } catch {
          /* unauthenticated */
        }
      }

      this.syncPhoneInputFromProfile();

      this.authService.userProfile$.subscribe((profile) => {
        this.userProfile = profile;
        this.syncPhoneInputFromProfile();
        if (profile?.inactive_blocked) {
          this.showInactiveBanner = true;
          void this.loadReactivationStatus();
        } else {
          this.reactivationStatus = null;
          this.showInactiveBanner = false;
        }
      });

      if (this.userProfile?.inactive_blocked) {
        await this.loadReactivationStatus();
      }
    } finally {
      this.loading = false;
    }
  }

  async loadReactivationStatus(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<{ request: any }>('/profile/reactivation-status')
      );
      this.reactivationStatus = res?.request || null;
      if (this.reactivationStatus?.status === 'approved') {
        this.authService.reloadUserProfile();
      }
    } catch {
      /* optional endpoint */
    }
  }

  openReactivationModal(): void {
    this.reactivationError = '';
    this.showReactivationModal = true;
  }

  closeReactivationModal(): void {
    this.showReactivationModal = false;
    this.reactivationError = '';
  }

  async submitReactivationRequest(): Promise<void> {
    this.reactivationSubmitting = true;
    this.reactivationError = '';
    try {
      await firstValueFrom(
        this.httpService.post<{ success: boolean; message: string }>(
          '/profile/reactivation-request',
          {}
        )
      );
      this.closeReactivationModal();
      await this.loadReactivationStatus();
    } catch (error: any) {
      const body = error?.error;
      this.reactivationError =
        body?.message || body?.error || error?.message || 'Could not send request.';
    } finally {
      this.reactivationSubmitting = false;
    }
  }

  accountStatusLabel(): string {
    if (!this.userProfile) return '—';
    if (this.userProfile.role !== 'customer') return 'Active (staff)';
    return this.userProfile.inactive_blocked === true ? 'Inactive — contact admin' : 'Active';
  }

  isPlaceholderPhone(phone: string | null | undefined): boolean {
    if (phone == null || String(phone).trim() === '') return true;
    return String(phone).startsWith('GOOGLE_');
  }

  displayPhoneLabel(phone: string): string {
    const d = String(phone).replace(/\D/g, '');
    if (d.length >= 10) return d.slice(-10);
    return phone;
  }

  private syncPhoneInputFromProfile(): void {
    const p = this.userProfile?.phone ?? null;
    if (this.isPlaceholderPhone(p)) {
      this.phoneEditValue = '';
      return;
    }
    this.phoneEditValue = this.displayPhoneLabel(p!);
  }

  isPhoneInputValid(): boolean {
    return /^[0-9]{10}$/.test((this.phoneEditValue || '').trim());
  }

  async saveMobileNumber(): Promise<void> {
    if (!this.isPhoneInputValid()) {
      this.phoneUpdateError = 'Enter a valid 10-digit mobile number.';
      this.phoneUpdateSuccess = '';
      return;
    }
    this.savingPhone = true;
    this.phoneUpdateError = '';
    this.phoneUpdateSuccess = '';
    try {
      const digits = (this.phoneEditValue || '').trim();
      await this.authService.updateProfile({ phone: digits });
      this.phoneUpdateSuccess = 'Mobile number saved.';
    } catch (error: any) {
      const body = error?.error;
      this.phoneUpdateError =
        body?.message ||
        (Array.isArray(body?.errors) && body.errors[0]?.message) ||
        body?.error ||
        error?.message ||
        'Could not update mobile number.';
    } finally {
      this.savingPhone = false;
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
}
