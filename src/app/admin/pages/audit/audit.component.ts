import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="audit-page">
      <h1 class="page-title">Audit Logs</h1>
      <table class="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngIf="logs.length === 0">
            <td colspan="5" style="text-align: center; padding: 40px; color: #6b7280;">
              No audit logs found.
            </td>
          </tr>
          <tr *ngFor="let log of logs">
            <td>{{ formatDateTime(log.created_at) }}</td>
            <td>{{ log.user?.full_name || 'System' }}</td>
            <td><span class="action-badge">{{ log.action }}</span></td>
            <td>{{ log.entity_type }}</td>
            <td><button class="btn-view" (click)="viewDetails(log)">View</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .audit-page { max-width: 1400px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin-bottom: 24px; }
    .data-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .data-table th, .data-table td { padding: 16px; text-align: left; font-size: 14px; }
    .data-table thead { background: #f9fafb; }
    .data-table tbody tr { border-top: 1px solid #e5e7eb; }
    .action-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1e40af; }
    .btn-view { padding: 6px 12px; border: none; border-radius: 6px; background: #f3f4f6; cursor: pointer; }
  `]
})
export class AdminAuditComponent implements OnInit {
  logs: any[] = [];

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs() {
    try {
      this.logs = await this.adminService.getAuditLogs();
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      this.logs = [];
    }
  }

  formatDateTime(date: string) {
    return new Date(date).toLocaleString();
  }

  viewDetails(log: any) {
    alert(JSON.stringify(log, null, 2));
  }
}
