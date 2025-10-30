import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <h1 class="page-title">Settings</h1>
      <div class="settings-list">
        <div *ngFor="let setting of settings" class="setting-card">
          <div class="setting-key">{{ setting.key }}</div>
          <div class="setting-description">{{ setting.description }}</div>
          <div class="setting-value">Value: {{ setting.value | json }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 1000px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin-bottom: 24px; }
    .settings-list { display: grid; gap: 16px; }
    .setting-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .setting-key { font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1f2937; }
    .setting-description { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
    .setting-value { font-size: 14px; font-family: monospace; background: #f3f4f6; padding: 8px; border-radius: 4px; }
  `]
})
export class AdminSettingsComponent implements OnInit {
  settings: any[] = [];

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadSettings();
  }

  async loadSettings() {
    this.settings = await this.adminService.getSettings();
  }
}
