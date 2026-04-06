import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, SiteSettings } from '../../../services/settings.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="admin-page-header settings-header-sticky">
        <h1 class="admin-page-title">Site Settings</h1>
        <div class="admin-page-actions">
          <button 
            class="admin-btn admin-btn-primary" 
            (click)="saveSettings()" 
            [disabled]="!hasChanges || saving"
            [class.success]="saveSuccess">
            <svg *ngIf="saveSuccess" class="admin-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {{ saving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save Changes') }}
          </button>
        </div>
      </div>

      <div class="settings-content">
        <!-- Site Information -->
        <section class="settings-section">
          <h2 class="section-title">Site Information</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Site Name</label>
              <input 
                type="text" 
                [(ngModel)]="settings.site_name" 
                (ngModelChange)="onChange()"
                placeholder="Kolkata Scotty"
                class="admin-input">
            </div>
            <div class="form-group">
              <label>Site Logo URL</label>
              <input 
                type="text" 
                [(ngModel)]="settings.site_logo" 
                (ngModelChange)="onChange()"
                placeholder="https://example.com/logo.png"
                class="admin-input">
              <small>Enter the URL of your logo image</small>
            </div>
          </div>
        </section>

        <!-- Contact Information -->
        <section class="settings-section">
          <h2 class="section-title">Contact Information</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Contact Email</label>
              <input 
                type="email" 
                [(ngModel)]="settings.contact_email" 
                (ngModelChange)="onChange()"
                placeholder="contact@example.com"
                class="admin-input">
            </div>
            <div class="form-group">
              <label>Contact Phone</label>
              <input 
                type="tel" 
                [(ngModel)]="settings.contact_phone" 
                (ngModelChange)="onChange()"
                placeholder="+91 1234567890"
                class="admin-input">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group form-group-full">
              <label>Address</label>
              <textarea 
                [(ngModel)]="settings.contact_address" 
                (ngModelChange)="onChange()"
                rows="2" 
                placeholder="Your business address"
                class="admin-textarea"></textarea>
            </div>
          </div>
        </section>

        <!-- Social Media Links -->
        <section class="settings-section">
          <h2 class="section-title">Social Media Links</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Facebook Page URL</label>
              <input 
                type="url" 
                [(ngModel)]="settings.social_facebook" 
                (ngModelChange)="onChange()"
                placeholder="https://facebook.com/yourpage"
                class="admin-input">
            </div>
            <div class="form-group">
              <label>Instagram Profile URL</label>
              <input 
                type="url" 
                [(ngModel)]="settings.social_instagram" 
                (ngModelChange)="onChange()"
                placeholder="https://instagram.com/yourprofile"
                class="admin-input">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>YouTube Channel URL</label>
              <input 
                type="url" 
                [(ngModel)]="settings.social_youtube" 
                (ngModelChange)="onChange()"
                placeholder="https://youtube.com/yourchannel"
                class="admin-input">
            </div>
            <div class="form-group"></div>
          </div>
        </section>

        <!-- Footer Settings -->
        <section class="settings-section">
          <h2 class="section-title">Footer Settings</h2>
          <div class="form-row">
            <div class="form-group">
              <label>Copyright Text</label>
              <input 
                type="text" 
                [(ngModel)]="settings.footer_copyright" 
                (ngModelChange)="onChange()"
                placeholder="© 2025 Your Company. All rights reserved."
                class="admin-input">
            </div>
            <div class="form-group"></div>
          </div>
          <div class="form-row">
            <div class="form-group form-group-full">
              <label>About Text</label>
              <textarea 
                [(ngModel)]="settings.about_text" 
                (ngModelChange)="onChange()"
                rows="3" 
                placeholder="Brief description about your business"
                class="admin-textarea"></textarea>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { 
      max-width: 1200px; 
      padding-bottom: 40px; 
    }

    .settings-header-sticky {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--admin-bg);
      padding-top: 20px;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--admin-border);
      box-shadow: var(--admin-shadow-sm);
      backdrop-filter: blur(8px);
    }

    .settings-content {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--admin-text);
      margin: 0;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--admin-border);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 0;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group-full {
      grid-column: 1 / -1;
    }

    .form-group label {
      font-size: 13px;
      font-weight: 500;
      color: var(--admin-text);
      margin: 0;
    }

    .admin-input {
      height: var(--admin-input-height);
      padding: 0 12px;
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius);
      font-size: 14px;
      background: var(--admin-bg);
      color: var(--admin-text);
      transition: var(--admin-transition);
      box-sizing: border-box;
      font-family: inherit;
      box-shadow: var(--admin-shadow-sm);
    }

    .admin-input:hover:not(:focus) {
      border-color: var(--admin-border-hover);
      background: var(--admin-bg-subtle);
    }

    .admin-input:focus {
      outline: none;
      border-color: var(--admin-primary);
      background: var(--admin-bg);
      box-shadow: 0 0 0 3px var(--admin-primary-light);
    }

    .admin-input::placeholder {
      color: var(--admin-text-muted);
    }

    .admin-textarea {
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius);
      font-size: 14px;
      background: var(--admin-bg);
      color: var(--admin-text);
      transition: var(--admin-transition);
      box-sizing: border-box;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      line-height: 1.5;
      box-shadow: var(--admin-shadow-sm);
    }

    .admin-textarea:hover:not(:focus) {
      border-color: var(--admin-border-hover);
      background: var(--admin-bg-subtle);
    }

    .admin-textarea:focus {
      outline: none;
      border-color: var(--admin-primary);
      background: var(--admin-bg);
      box-shadow: 0 0 0 3px var(--admin-primary-light);
    }

    .admin-textarea::placeholder {
      color: var(--admin-text-muted);
    }

    .form-group small {
      font-size: 11px;
      color: var(--admin-text-secondary);
      margin-top: 2px;
    }

    .admin-btn-primary.success {
      background: var(--admin-success);
      border-color: var(--admin-success);
    }

    .admin-btn-primary.success:hover:not(:disabled) {
      background: #059669;
      border-color: #059669;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .settings-content {
        gap: 24px;
      }
    }
  `]
})
export class AdminSettingsComponent implements OnInit {
  settings: SiteSettings = {
    site_name: '',
    site_logo: '',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    social_facebook: '',
    social_instagram: '',
    social_youtube: '',
    footer_copyright: '',
    about_text: ''
  };
  originalSettings: SiteSettings = { ...this.settings };
  saving = false;
  saveSuccess = false;
  hasChanges = false;

  constructor(
    private settingsService: SettingsService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      await this.settingsService.loadSettings();
      this.settings = { ...this.settingsService.getSettings() };
      this.originalSettings = { ...this.settings };
      this.hasChanges = false;
      this.saveSuccess = false;
    } catch {
      this.toastService.error('Failed to load settings');
    }
  }

  onChange() {
    this.hasChanges = JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
    this.saveSuccess = false;
  }

  async saveSettings() {
    if (!this.hasChanges || this.saving) return;

    this.saving = true;
    this.saveSuccess = false;

    try {
      await this.settingsService.updateSettings(this.settings);
      this.originalSettings = { ...this.settings };
      this.hasChanges = false;
      this.saveSuccess = true;
      this.toastService.success('Settings saved successfully');

      // Reset success state after 2 seconds
      setTimeout(() => {
        this.saveSuccess = false;
      }, 2000);
    } catch {
      this.toastService.error('Failed to save settings');
    } finally {
      this.saving = false;
    }
  }
}
