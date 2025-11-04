import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { Trainer } from '../../../services/trainer.service';

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

      <div class="filters-bar">
        <input 
          type="text" 
          [(ngModel)]="searchTerm" 
          (input)="filterTrainers()"
          placeholder="Search by name, email, or specialization..." 
          class="search-input">
        <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="page-size-select">
          <option [value]="5">5 per page</option>
          <option [value]="10">10 per page</option>
          <option [value]="20">20 per page</option>
          <option [value]="50">50 per page</option>
        </select>
      </div>

      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Experience</th>
            <th>Rating</th>
            <th>Specialization</th>
            <th>Status</th>
            <th>On Duty</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let trainer of getPaginatedTrainers()">
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
              <button
                class="duty-toggle"
                [class.on-duty]="trainer.on_duty"
                [class.off-duty]="!trainer.on_duty"
                (click)="toggleOnDuty(trainer.id, trainer.on_duty)">
                {{ trainer.on_duty ? 'On Duty' : 'Off Duty' }}
              </button>
            </td>
            <td>
              <div class="action-buttons">
                <button
                  class="btn-icon"
                  [class.btn-success]="!trainer.is_active"
                  [class.btn-warning]="trainer.is_active"
                  (click)="toggleActive(trainer.id, trainer.is_active)"
                  [title]="trainer.is_active ? 'Deactivate' : 'Activate'">
                  <span class="icon">{{ trainer.is_active ? '⏸️' : '▶️' }}</span>
                </button>
                <button
                  class="btn-icon btn-info"
                  (click)="showEditModal(trainer)"
                  title="Edit">
                  <span class="icon">✏️</span>
                </button>
                <button
                  class="btn-icon btn-danger"
                  (click)="deleteTrainer(trainer.id)"
                  title="Delete">
                  <span class="icon">🗑️</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      <div class="pagination-container" *ngIf="totalPages > 1">
        <button 
          class="pagination-btn" 
          [disabled]="currentPage === 1"
          (click)="goToPage(currentPage - 1)">
          ← Previous
        </button>
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }} ({{ filteredTrainers.length }} trainers)
        </span>
        <button 
          class="pagination-btn" 
          [disabled]="currentPage === totalPages"
          (click)="goToPage(currentPage + 1)">
          Next →
        </button>
      </div>

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
          <div class="form-group">
            <label>Rating (0 - 5)</label>
            <input type="number" step="0.1" min="0" max="5" [(ngModel)]="trainerForm.rating" name="rating" />
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
    .btn-primary { padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.2s; }
    .btn-primary:hover { transform: translateY(-2px); }
    .data-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .data-table th, .data-table td { padding: 16px; text-align: left; }
    .data-table thead { background: #f9fafb; }
    .data-table tbody tr { border-top: 1px solid #e5e7eb; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-badge { background: #fee2e2; color: #991b1b; }
    .status-badge.active { background: #d1fae5; color: #065f46; }
    .action-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn-icon {
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      background: #f3f4f6;
    }

    .btn-icon .icon {
      font-size: 16px;
      line-height: 1;
    }

    .btn-icon.btn-success {
      background: #10b981;
      color: white;
    }

    .btn-icon.btn-success:hover {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
    }

    .btn-icon.btn-warning {
      background: #f59e0b;
      color: white;
    }

    .btn-icon.btn-warning:hover {
      background: #d97706;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
    }

    .btn-icon.btn-info {
      background: #3b82f6;
      color: white;
    }

    .btn-icon.btn-info:hover {
      background: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
    }

    .btn-icon.btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-icon.btn-danger:hover {
      background: #dc2626;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
    }
    .duty-toggle { padding: 6px 14px; border: none; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .duty-toggle.on-duty { background: #d1fae5; color: #065f46; }
    .duty-toggle.on-duty:hover { background: #a7f3d0; }
    .duty-toggle.off-duty { background: #fee2e2; color: #991b1b; }
    .duty-toggle.off-duty:hover { background: #fecaca; }
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
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #3b82f6; }
    .form-group input:disabled { background: #f3f4f6; color: #9ca3af; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
    .btn-secondary { padding: 10px 20px; background: white; color: #4b5563; border: 2px solid #e5e7eb; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .btn-secondary:hover { background: #f9fafb; }
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
    .search-input { flex: 1; padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .search-input:focus { outline: none; border-color: #3b82f6; }
    .page-size-select { padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .pagination-container { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; padding: 20px; }
    .pagination-btn { padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .pagination-btn:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
    .pagination-btn:not(:disabled):hover { transform: translateY(-2px); }
    .page-info { color: #6b7280; font-size: 14px; }
  `]
})
export class AdminTrainersComponent implements OnInit {
  trainers: Trainer[] = [];
  filteredTrainers: Trainer[] = [];
  showModal = false;
  editingTrainer: Trainer | null = null;
  specializationInput = '';
  searchTerm = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  trainerForm: any = {
    full_name: '',
    email: '',
    phone: '',
    bio: '',
    experience_years: 0,
    specialization: [],
    rating: 0
  };

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadTrainers();
  }

  async loadTrainers() {
    try {
      this.trainers = await this.adminService.getAllTrainers();
      this.filterTrainers();
    } catch (error) {
      console.error('Failed to load trainers:', error);
      alert('Failed to load trainers');
    }
  }

  filterTrainers() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredTrainers = [...this.trainers];
    } else {
      this.filteredTrainers = this.trainers.filter(trainer => 
        trainer.profile?.full_name?.toLowerCase().includes(term) ||
        trainer.profile?.email?.toLowerCase().includes(term) ||
        trainer.specialization?.some(s => s.toLowerCase().includes(term))
      );
    }
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredTrainers.length / this.itemsPerPage);
  }

  getPaginatedTrainers(): Trainer[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredTrainers.slice(start, end);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
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

  showEditModal(trainer: Trainer) {
    this.editingTrainer = trainer;
    this.trainerForm = {
      full_name: trainer.profile?.full_name || '',
      email: trainer.profile?.email || '',
      phone: trainer.profile?.phone || '',
      bio: trainer.bio,
      experience_years: trainer.experience_years,
      specialization: trainer.specialization,
      rating: trainer.rating || 0
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
      const specialization = this.specializationInput
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (this.editingTrainer) {
        const data = {
          full_name: this.trainerForm.full_name,
          phone: this.trainerForm.phone || null,
          bio: this.trainerForm.bio,
          experience_years: parseInt(this.trainerForm.experience_years) || 0,
          specialization: specialization,
          rating: parseFloat(this.trainerForm.rating) || 0
        };
        await this.adminService.updateTrainer(this.editingTrainer.id, data).toPromise();
      } else {
        const data = {
          email: this.trainerForm.email,
          full_name: this.trainerForm.full_name,
          phone: this.trainerForm.phone || null,
          bio: this.trainerForm.bio,
          experience_years: parseInt(this.trainerForm.experience_years) || 0,
          specialization: specialization,
          rating: parseFloat(this.trainerForm.rating) || 0
        };
        await this.adminService.createTrainer(data).toPromise();
      }

      this.showModal = false;
      await this.loadTrainers();
    } catch (error: any) {
      console.error('Error saving trainer:', error);
      alert(error.error?.error || error.error?.message || 'Failed to save trainer');
    }
  }

  async toggleOnDuty(trainerId: string, currentStatus: boolean) {
    try {
      // Note: on_duty is not a standard field, but we can add it if needed
      // For now, we'll use is_active as a proxy
      await this.adminService.updateTrainer(trainerId, { is_active: !currentStatus }).toPromise();
      await this.loadTrainers();
    } catch (error) {
      console.error('Error updating duty status:', error);
      alert('Failed to update duty status');
    }
  }

  async toggleActive(trainerId: string, currentStatus: boolean) {
    try {
      await this.adminService.updateTrainer(trainerId, { is_active: !currentStatus }).toPromise();
      await this.loadTrainers();
    } catch (error) {
      console.error('Error updating trainer status:', error);
      alert('Failed to update trainer status');
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
      console.error('Error deleting trainer:', error);
      alert(error.error?.error || error.error?.message || 'Failed to delete trainer');
    }
  }
}
