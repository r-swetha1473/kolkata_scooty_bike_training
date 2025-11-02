import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, SiteSettings } from '../../../services/settings.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1 class="page-title">Site Settings</h1>
        <button class="btn-primary" (click)="saveSettings()" [disabled]="saving">
          {{ saving ? 'Saving...' : '💾 Save Changes' }}
        </button>
      </div>

      <div class="settings-sections">
        <div class="settings-card">
          <h2 class="section-title">Site Information</h2>
          <div class="form-group">
            <label>Site Name</label>
            <input type="text" [(ngModel)]="settings.site_name" placeholder="Kolkata Scotty">
          </div>
          <div class="form-group">
            <label>Site Logo URL</label>
            <input type="text" [(ngModel)]="settings.site_logo" placeholder="https://example.com/logo.png">
            <small>Enter the URL of your logo image</small>
          </div>
        </div>

        <div class="settings-card">
          <h2 class="section-title">Contact Information</h2>
          <div class="form-group">
            <label>Contact Email</label>
            <input type="email" [(ngModel)]="settings.contact_email" placeholder="contact@example.com">
          </div>
          <div class="form-group">
            <label>Contact Phone</label>
            <input type="tel" [(ngModel)]="settings.contact_phone" placeholder="+91 1234567890">
          </div>
          <div class="form-group">
            <label>Address</label>
            <textarea [(ngModel)]="settings.contact_address" rows="3" placeholder="Your business address"></textarea>
          </div>
        </div>

        <div class="settings-card">
          <h2 class="section-title">Social Media Links</h2>
          <div class="form-group">
            <label>Facebook Page URL</label>
            <input type="url" [(ngModel)]="settings.social_facebook" placeholder="https://facebook.com/yourpage">
          </div>
          <div class="form-group">
            <label>Instagram Profile URL</label>
            <input type="url" [(ngModel)]="settings.social_instagram" placeholder="https://instagram.com/yourprofile">
          </div>
          <div class="form-group">
            <label>YouTube Channel URL</label>
            <input type="url" [(ngModel)]="settings.social_youtube" placeholder="https://youtube.com/yourchannel">
          </div>
        </div>

        <div class="settings-card">
          <h2 class="section-title">Footer Settings</h2>
          <div class="form-group">
            <label>Copyright Text</label>
            <input type="text" [(ngModel)]="settings.footer_copyright" placeholder="© 2025 Your Company. All rights reserved.">
          </div>
          <div class="form-group">
            <label>About Text</label>
            <textarea [(ngModel)]="settings.about_text" rows="4" placeholder="Brief description about your business"></textarea>
          </div>
        </div>
      </div>

      <div class="save-footer">
        <button class="btn-primary btn-large" (click)="saveSettings()" [disabled]="saving">
          {{ saving ? 'Saving Changes...' : '💾 Save All Changes' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 1000px; padding-bottom: 100px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin: 0; }
    .btn-primary { padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-large { padding: 16px 32px; font-size: 16px; }
    .settings-sections { display: grid; gap: 24px; }
    .settings-card { background: white; padding: 28px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px; }
    .form-group input, .form-group textarea { width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; transition: border-color 0.2s; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #3b82f6; }
    .form-group small { display: block; margin-top: 6px; font-size: 12px; color: #6b7280; }
    .form-group textarea { resize: vertical; min-height: 80px; }
    .save-footer { position: fixed; bottom: 0; left: 260px; right: 0; background: white; padding: 20px 40px; border-top: 2px solid #e5e7eb; display: flex; justify-content: center; z-index: 100; box-shadow: 0 -4px 12px rgba(0,0,0,0.1); }
    @media (max-width: 768px) { .save-footer { left: 0; } }
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
  saving = false;

  constructor(private settingsService: SettingsService) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      await this.settingsService.loadSettings();
      this.settings = this.settingsService.getSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Failed to load settings');
    }
  }

  async saveSettings() {
    this.saving = true;
    try {
      await this.settingsService.updateSettings(this.settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      this.saving = false;
    }
  }
}
