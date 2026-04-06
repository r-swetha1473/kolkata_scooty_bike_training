import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';
import { HttpService } from '../../services/http.service';
import { firstValueFrom } from 'rxjs';
import { setAuthToken } from '../../utils/auth-token.storage';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="profile-page">
      <div *ngIf="loading && !userProfile" class="loading">Loading profile…</div>

      <div *ngIf="showInactiveBanner" class="banner-inactive" role="alert">
        Your account is inactive. Contact admin.
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
        font-weight: 600;
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

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private httpService: HttpService
  ) {}

  async ngOnInit() {
    this.loading = true;
    try {
      const oauthToken = this.route.snapshot.queryParamMap.get('token');
      if (oauthToken) {
        setAuthToken(oauthToken);
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
        }
      });
    } finally {
      this.loading = false;
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
