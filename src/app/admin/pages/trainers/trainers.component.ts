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
      <div class="page-header">
        <h1 class="page-title">Manage Trainers</h1>
        <button class="btn-primary" (click)="showCreateModal()">+ Add Trainer</button>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Experience</th>
            <th>Rating</th>
            <th>Specialization</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let trainer of trainers">
            <td>{{ trainer.profile?.full_name }}</td>
            <td>{{ trainer.profile?.email }}</td>
            <td>{{ trainer.experience_years }} years</td>
            <td>{{ trainer.rating || 0 }} / 5</td>
            <td>{{ trainer.specialization?.join(', ') || 'N/A' }}</td>
            <td>
              <span class="status-badge" [class.active]="trainer.is_active">
                {{ trainer.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <button class="btn-sm" [class.btn-success]="!trainer.is_active" [class.btn-warning]="trainer.is_active" (click)="toggleActive(trainer.id, trainer.is_active)">
                {{ trainer.is_active ? 'Deactivate' : 'Activate' }}
              </button>
              <button class="btn-sm btn-info" (click)="showEditModal(trainer)">Edit</button>
              <button class="btn-sm btn-danger" (click)="deleteTrainer(trainer.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="modal" *ngIf="showModal" (click)="closeModal($event)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingTrainer ? 'Edit Trainer' : 'Add New Trainer' }}</h2>
            <button class="btn-close" (click)="closeModal($event)">&times;</button>
          </div>
          <form (ngSubmit)="saveTrainer()" class="modal-form">
            <div class="form-group">
              <label>Full Name *</label>
              <input type="text" [(ngModel)]="trainerForm.full_name" name="full_name" required />
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="trainerForm.email" name="email" required [disabled]="editingTrainer" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" [(ngModel)]="trainerForm.phone" name="phone" />
            </div>
            <div class="form-group">
              <label>Bio *</label>
              <textarea [(ngModel)]="trainerForm.bio" name="bio" rows="3" required></textarea>
            </div>
            <div class="form-group">
              <label>Experience Years *</label>
              <input type="number" [(ngModel)]="trainerForm.experience_years" name="experience_years" min="0" required />
            </div>
            <div class="form-group">
              <label>Specialization (comma-separated)</label>
              <input type="text" [(ngModel)]="specializationInput" name="specialization" placeholder="e.g., Beginner Training, Highway Riding" />
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="closeModal($event)">Cancel</button>
              <button type="submit" class="btn-primary">{{ editingTrainer ? 'Update' : 'Create' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .trainers-page { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin: 0; }
    .btn-primary { padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
    .btn-primary:hover { transform: translateY(-2px); }
    .data-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .data-table th, .data-table td { padding: 16px; text-align: left; }
    .data-table thead { background: #f9fafb; }
    .data-table tbody tr { border-top: 1px solid #e5e7eb; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-badge { background: #fee2e2; color: #991b1b; }
    .status-badge.active { background: #d1fae5; color: #065f46; }
    .btn-sm { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; margin-right: 4px; transition: all 0.2s; }
    .btn-success { background: #10b981; color: white; }
    .btn-success:hover { background: #059669; }
    .btn-warning { background: #f59e0b; color: white; }
    .btn-warning:hover { background: #d97706; }
    .btn-info { background: #3b82f6; color: white; }
    .btn-info:hover { background: #2563eb; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; border-radius: 12px; padding: 0; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 24px; border-bottom: 1px solid #e5e7eb; }
    .modal-header h2 { margin: 0; font-size: 24px; color: #1f2937; }
    .btn-close { background: none; border: none; font-size: 32px; cursor: pointer; color: #6b7280; line-height: 1; }
    .btn-close:hover { color: #1f2937; }
    .modal-form { padding: 24px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
    .form-group input:disabled { background: #f3f4f6; color: #9ca3af; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
    .btn-secondary { padding: 10px 20px; background: white; color: #4b5563; border: 2px solid #e5e7eb; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-secondary:hover { background: #f9fafb; }
  `]
})
export class AdminTrainersComponent implements OnInit {
  trainers: any[] = [];
  showModal = false;
  editingTrainer: any = null;
  specializationInput = '';
  trainerForm: any = {
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    experience_years: 0,
    specialization: []
  };

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadTrainers();
  }

  async loadTrainers() {
    this.trainers = await this.adminService.getAllTrainers();
  }

  showCreateModal() {
    this.editingTrainer = null;
    this.trainerForm = {
      full_name: '',
      email: '',
      phone: '',
      bio: '',
      experience_years: 0,
      specialization: []
    };
    this.specializationInput = '';
    this.showModal = true;
  }

  showEditModal(trainer: any) {
    this.editingTrainer = trainer;
    this.trainerForm = {
      full_name: trainer.profile?.full_name || '',
      email: trainer.profile?.email || '',
      phone: trainer.profile?.phone || '',
      bio: trainer.bio,
      experience_years: trainer.experience_years,
      specialization: trainer.specialization
    };
    this.specializationInput = trainer.specialization?.join(', ') || '';
    this.showModal = true;
  }

  closeModal(event: Event) {
    event.preventDefault();
    this.showModal = false;
    this.editingTrainer = null;
  }

  async saveTrainer() {
    try {
      const data = {
        ...this.trainerForm,
        specialization: this.specializationInput
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
      };

      if (this.editingTrainer) {
        await this.adminService.updateTrainer(this.editingTrainer.id, data).toPromise();
      } else {
        await this.adminService.createTrainer(data).toPromise();
      }

      this.showModal = false;
      await this.loadTrainers();
    } catch (error: any) {
      alert(error.error?.error || 'Failed to save trainer');
    }
  }

  async toggleActive(trainerId: string, currentStatus: boolean) {
    try {
      await this.adminService.updateTrainer(trainerId, { is_active: !currentStatus }).toPromise();
      await this.loadTrainers();
    } catch (error: any) {
      alert(error.error?.error || 'Failed to update trainer');
    }
  }

  async deleteTrainer(trainerId: string) {
    if (!confirm('Are you sure you want to delete this trainer? This action cannot be undone.')) {
      return;
    }

    try {
      await this.adminService.deleteTrainer(trainerId).toPromise();
      await this.loadTrainers();
    } catch (error: any) {
      alert(error.error?.error || error.error?.message || 'Failed to delete trainer');
    }
  }
}
