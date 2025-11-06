import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { Trainer } from '../../../services/trainer.service';
import { ToastService } from '../../../services/toast.service';

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
        <table class="data-table compact-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Exp</th>
            <th>Rating</th>
            <th>Specialization</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let trainer of getPaginatedTrainers()">
            <td>{{ trainer.profile?.full_name }}</td>
            <td class="email-cell">{{ trainer.profile?.email }}</td>
            <td>{{ trainer.experience_years }}y</td>
            <td>{{ trainer.rating || 0 }}/5</td>
            <td class="specialization-cell">{{ (trainer.specialization?.join(', ') || 'N/A').substring(0, 30) }}{{ (trainer.specialization?.join(', ') || '').length > 30 ? '...' : '' }}</td>
            <td>
              <span class="status-badge" [class.active]="trainer.is_active">
                {{ trainer.is_active ? 'Active' : 'Inactive' }}
              </span>
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

      <div class="pagination-pill" *ngIf="totalPages > 1">
        <button 
          class="nav-btn"
          [disabled]="currentPage === 1"
          (click)="goToPage(currentPage - 1)">‹ Prev</button>

        <div class="page-numbers">
          <button 
            *ngFor="let page of getPageNumbers()"
            class="page-chip"
            [class.active]="page === currentPage"
            [class.ellipsis]="page === '...'"
            [disabled]="page === '...'"
            (click)="page !== '...' && goToPage(page)">
            {{ page }}
          </button>
        </div>

        <button 
          class="nav-btn"
          [disabled]="currentPage === totalPages"
          (click)="goToPage(currentPage + 1)">Next ›</button>

        <div class="results-info">Showing {{ getShowingCount() }} of {{ filteredTrainers.length }} results</div>
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
    .data-table { width: 100%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-collapse: collapse; }
    .data-table.compact-table th, .data-table.compact-table td { padding: 10px 12px; text-align: left; font-size: 13px; }
    .data-table.compact-table th { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .data-table thead { background: #f9fafb; }
    .data-table tbody tr { border-top: 1px solid #e5e7eb; }
    .data-table tbody tr:hover { background: #f9fafb; }
    .email-cell { font-size: 12px; color: #6b7280; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .specialization-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-badge { background: #fee2e2; color: #991b1b; }
    .status-badge.active { background: #d1fae5; color: #065f46; }
    .action-buttons { display: flex; gap: 8px; align-items: center; }

    /* Pagination pill */
    .pagination-pill { display:flex; align-items:center; gap:16px; justify-content: space-between; background:white; border-radius: 9999px; padding: 12px 18px; margin:24px 0; box-shadow: 0 10px 25px rgba(0,0,0,0.08), inset 0 0 0 1px #e5e7eb; flex-wrap: wrap; }
    .nav-btn { background: none; border: none; color: #1f2937; font-weight: 600; cursor: pointer; padding: 8px 10px; border-radius: 9999px; }
    .nav-btn:disabled { color: #9ca3af; cursor: not-allowed; }
    .page-numbers { display: flex; gap: 8px; align-items: center; }
    .page-chip { min-width: 36px; height: 36px; border-radius: 9999px; border: 1px solid #e5e7eb; background: white; color: #1f2937; font-weight: 600; cursor: pointer; }
    .page-chip:hover:not(.active):not(.ellipsis) { border-color: #6366f1; color: #6366f1; }
    .page-chip.active { background: #4f46e5; color: white; border-color: #4f46e5; box-shadow: 0 0 0 6px rgba(79,70,229,0.15); }
    .page-chip.ellipsis { border: none; background: none; cursor: default; color: #6b7280; }
    .results-info { color: #4b5563; font-size: 14px; margin-left: auto; }

    .btn-icon { width: 36px; height: 36px; padding: 0; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; background: #f3f4f6; }
    .btn-icon .icon { font-size: 16px; line-height: 1; }
    .btn-icon.btn-success { background: #10b981; color: white; }
    .btn-icon.btn-success:hover { background: #059669; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3); }
    .btn-icon.btn-warning { background: #f59e0b; color: white; }
    .btn-icon.btn-warning:hover { background: #d97706; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3); }
    .btn-icon.btn-info { background: #3b82f6; color: white; }
    .btn-icon.btn-info:hover { background: #2563eb; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3); }
    .btn-icon.btn-danger { background: #ef4444; color: white; }
    .btn-icon.btn-danger:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3); }

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

  constructor(
    private adminService: AdminService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadTrainers();
  }

  async loadTrainers() {
    try {
      this.trainers = await this.adminService.getAllTrainers();
      this.filterTrainers();
    } catch (error) {
      console.error('Failed to load trainers:', error);
      this.toastService.error('Failed to load trainers');
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

  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else if (current <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 2) {
      pages.push(1, '...');
      for (let i = total - 3; i <= total; i++) pages.push(i);
    } else {
      pages.push(1, '...');
      pages.push(current - 1, current, current + 1);
      pages.push('...', total);
    }
    return pages;
  }

  getShowingCount(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.filteredTrainers.length);
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
      this.toastService.success(this.editingTrainer ? 'Trainer updated successfully' : 'Trainer created successfully');
    } catch (error: any) {
      console.error('Error saving trainer:', error);
      this.toastService.error(error.error?.error || error.error?.message || 'Failed to save trainer');
    }
  }

  async toggleActive(trainerId: string, currentStatus: boolean) {
    try {
      await this.adminService.updateTrainer(trainerId, { is_active: !currentStatus }).toPromise();
      await this.loadTrainers();
      this.toastService.success(`Trainer ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      console.error('Error updating trainer status:', error);
      this.toastService.error(error.error?.error || error.error?.message || 'Failed to update trainer status');
    }
  }

  async deleteTrainer(trainerId: string) {
    if (!confirm('Are you sure you want to delete this trainer? This action cannot be undone.')) {
      return;
    }

    try {
      await this.adminService.deleteTrainer(trainerId).toPromise();
      await this.loadTrainers();
      this.toastService.success('Trainer deleted successfully');
    } catch (error: any) {
      console.error('Error deleting trainer:', error);
      this.toastService.error(error.error?.error || error.error?.message || 'Failed to delete trainer');
    }
  }
}
