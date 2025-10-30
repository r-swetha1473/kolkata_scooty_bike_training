import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-admin-trainers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="trainers-page">
      <h1 class="page-title">Manage Trainers</h1>
      <div class="trainers-grid">
        <div *ngFor="let trainer of trainers" class="trainer-card">
          <div class="trainer-info">
            <div class="trainer-name">{{ trainer.profile?.full_name }}</div>
            <div class="trainer-rating">⭐ {{ trainer.rating || 0 }} / 5</div>
            <div class="trainer-experience">{{ trainer.experience_years }} years experience</div>
            <div class="trainer-sessions">{{ trainer.total_sessions }} sessions completed</div>
            <span class="status-badge" [class.active]="trainer.is_active">
              {{ trainer.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="trainer-actions">
            <button class="btn-toggle" (click)="toggleActive(trainer.id, !trainer.is_active)">
              {{ trainer.is_active ? 'Deactivate' : 'Activate' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .trainers-page { max-width: 1200px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin-bottom: 24px; }
    .trainers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .trainer-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .trainer-name { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .trainer-rating, .trainer-experience, .trainer-sessions { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 8px; background: #fee2e2; color: #991b1b; }
    .status-badge.active { background: #d1fae5; color: #065f46; }
    .trainer-actions { margin-top: 16px; }
    .btn-toggle { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; background: #667eea; color: white; font-weight: 600; width: 100%; }
  `]
})
export class AdminTrainersComponent implements OnInit {
  trainers: any[] = [];

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadTrainers();
  }

  async loadTrainers() {
    this.trainers = await this.adminService.getAllTrainers();
  }

  async toggleActive(id: string, isActive: boolean) {
    await this.adminService.updateTrainer(id, { is_active: isActive });
    await this.loadTrainers();
  }
}
