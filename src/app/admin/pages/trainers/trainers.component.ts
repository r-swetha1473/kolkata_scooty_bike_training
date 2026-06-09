import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, TrainerDeletePreview } from '../../../services/admin.service';
import { Trainer } from '../../../services/trainer.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-trainers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="trainers-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Manage Trainers</h1>
        <div class="admin-page-actions">
          <button class="admin-btn admin-btn-primary" (click)="showCreateModal()">+ Add Trainer</button>
        </div>
      </div>

      <div class="admin-filters-bar">
        <div class="admin-filters-content">
          <div class="admin-filter-group admin-search-group">
            <svg class="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              [(ngModel)]="searchTerm" 
              (input)="filterTrainers()"
              placeholder="Search name, email, specialization..." 
              class="admin-search-input">
          </div>
          <div class="admin-filter-group">
            <select [(ngModel)]="statusFilter" (change)="filterTrainers()" class="admin-select">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>
          <div class="admin-filter-group">
            <select [(ngModel)]="sortBy" (change)="filterTrainers()" class="admin-select">
              <option value="none">Sort by</option>
              <option value="rating">Rating</option>
              <option value="experience">Experience</option>
            </select>
          </div>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-data-table">
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
            <td class="specialization-cell">
              <div class="specialization-text">{{ trainer.specialization?.join(', ') || 'N/A' }}</div>
            </td>
            <td>
              <span class="status-badge" [class.active]="trainer.is_active">
                {{ trainer.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button
                  class="btn-action btn-edit"
                  (click)="showEditModal(trainer)"
                  title="Edit">
                  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  class="btn-action btn-disable"
                  (click)="toggleActive(trainer.id, trainer.is_active)"
                  [title]="trainer.is_active ? 'Disable' : 'Enable'">
                  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" *ngIf="trainer.is_active">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" *ngIf="!trainer.is_active">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
                <button
                  class="btn-action btn-delete"
                  (click)="confirmDelete(trainer)"
                  title="Delete"
                  [disabled]="trainer.is_active">
                  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      <div class="admin-pagination" *ngIf="filteredTrainers.length > 0">
        <div class="admin-pagination-info">
          <span class="admin-pagination-count">Showing {{ getStartIndex() }}–{{ getEndIndex() }} of {{ filteredTrainers.length }} trainers</span>
          <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="admin-page-size-select">
            <option [value]="8">8</option>
            <option [value]="16">16</option>
            <option [value]="24">24</option>
            <option [value]="32">32</option>
          </select>
        </div>
        <div class="admin-pagination-controls" *ngIf="totalPages > 1">
          <button 
            class="admin-pagination-btn" 
            [disabled]="currentPage === 1"
            (click)="goToPage(currentPage - 1)"
            title="Previous page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <ng-container *ngFor="let page of getPageNumbers()">
            <button
              *ngIf="typeof page === 'number'"
              class="admin-pagination-btn"
              [class.active]="page === currentPage"
              (click)="goToPage(page)"
              [title]="'Go to page ' + page">
              {{ page }}
            </button>
            <span *ngIf="page === '...'" class="admin-page-ellipsis">...</span>
          </ng-container>
          <button 
            class="admin-pagination-btn" 
            [disabled]="currentPage === totalPages"
            (click)="goToPage(currentPage + 1)"
            title="Next page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div class="modal" *ngIf="showDeleteModal" (click)="closeDeleteModal()">
        <div class="modal-content delete-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Delete Trainer</h2>
            <button type="button" class="btn-close" (click)="closeDeleteModal()">&times;</button>
          </div>
          <div class="modal-form">
            <div *ngIf="deletePreviewLoading" class="delete-loading">Loading booking summary...</div>

            <ng-container *ngIf="!deletePreviewLoading && deletePreview">
              <p *ngIf="trainerToDelete?.is_active" class="warning-text">
                This trainer is still active. Deactivate them before deleting.
              </p>

              <ng-container *ngIf="!trainerToDelete?.is_active">
                <p *ngIf="deleteStep === 'summary' && deletePreview.canDeleteDirectly">
                  Are you sure you want to delete <strong>{{ deletePreview.trainerName }}</strong>?
                  This will remove the trainer record and revert their profile role to customer.
                </p>

                <ng-container *ngIf="deleteStep === 'summary' && !deletePreview.canDeleteDirectly">
                  <p class="warning-text">
                    Trainer has existing bookings. Some bookings may not have been marked as completed.
                    Please review them before deleting this trainer.
                  </p>
                  <p class="past-warning" *ngIf="deletePreview.pastBlockingBookings > 0">
                    {{ getPastBookingsWarning() }}
                  </p>
                  <div class="booking-stats">
                    <div class="stat-item"><span>Total</span><strong>{{ deletePreview.totalBookings }}</strong></div>
                    <div class="stat-item"><span>Pending</span><strong>{{ deletePreview.pendingBookings }}</strong></div>
                    <div class="stat-item"><span>Active</span><strong>{{ deletePreview.activeBookings }}</strong></div>
                    <div class="stat-item"><span>Completed</span><strong>{{ deletePreview.completedBookings }}</strong></div>
                    <div class="stat-item" *ngIf="deletePreview.pastBlockingBookings > 0">
                      <span>Past (uncompleted)</span><strong>{{ deletePreview.pastBlockingBookings }}</strong>
                    </div>
                    <div class="stat-item" *ngIf="deletePreview.futureBlockingBookings > 0">
                      <span>Upcoming</span><strong>{{ deletePreview.futureBlockingBookings }}</strong>
                    </div>
                  </div>
                </ng-container>

                <p *ngIf="deleteStep === 'complete_past_confirm'" class="warning-text">
                  Mark <strong>{{ deletePreview.pastBlockingBookings }}</strong> past
                  booking{{ deletePreview.pastBlockingBookings === 1 ? '' : 's' }} as <strong>Completed</strong>?
                  <span *ngIf="deletePreview.futureBlockingBookings > 0">
                    Upcoming bookings will not be changed.
                  </span>
                  <span *ngIf="deletePreview.futureBlockingBookings === 0">
                    The trainer will be deleted if no other bookings remain.
                  </span>
                </p>

                <p *ngIf="deleteStep === 'complete_confirm'" class="warning-text">
                  Are you sure all trainer sessions are completed?
                  This will mark all non-completed bookings as <strong>Completed</strong> before deleting the trainer.
                </p>

                <div *ngIf="deleteStep === 'reassign'" class="form-group">
                  <label>Reassign active/pending bookings to</label>
                  <select [(ngModel)]="reassignToTrainerId" name="reassignTrainer" class="admin-select reassign-select">
                    <option value="">Select an active trainer</option>
                    <option *ngFor="let t of deletePreview.availableReassignTrainers" [value]="t.id">
                      {{ t.name }}
                    </option>
                  </select>
                  <p class="form-help">Booking history will be preserved. Only active and pending bookings are reassigned.</p>
                </div>
              </ng-container>
            </ng-container>

            <div class="form-actions" *ngIf="!deletePreviewLoading && deletePreview && !trainerToDelete?.is_active">
              <ng-container *ngIf="deleteStep === 'summary' && deletePreview.canDeleteDirectly">
                <button type="button" class="btn-secondary" (click)="closeDeleteModal()">Cancel</button>
                <button type="button" class="btn-danger" (click)="deleteTrainer('direct')" [disabled]="deletingTrainer">
                  {{ deletingTrainer ? 'Deleting...' : 'Delete' }}
                </button>
              </ng-container>

              <ng-container *ngIf="deleteStep === 'summary' && !deletePreview.canDeleteDirectly">
                <button type="button" class="btn-secondary" (click)="closeDeleteModal()">Cancel Delete</button>
                <button
                  type="button"
                  class="btn-primary btn-past"
                  *ngIf="deletePreview.pastBlockingBookings > 0"
                  (click)="deleteStep = 'complete_past_confirm'">
                  Mark Past Bookings as Completed
                </button>
                <button type="button" class="btn-primary" (click)="deleteStep = 'complete_confirm'">
                  Mark All Bookings as Completed
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  (click)="deleteStep = 'reassign'"
                  [disabled]="deletePreview.availableReassignTrainers.length === 0">
                  Reassign Trainer
                </button>
              </ng-container>

              <ng-container *ngIf="deleteStep === 'complete_past_confirm'">
                <button type="button" class="btn-secondary" (click)="deleteStep = 'summary'">Back</button>
                <button type="button" class="btn-danger" (click)="deleteTrainer('complete_past')" [disabled]="deletingTrainer">
                  {{ deletingTrainer ? 'Processing...' : 'Mark Past & Continue' }}
                </button>
              </ng-container>

              <ng-container *ngIf="deleteStep === 'complete_confirm'">
                <button type="button" class="btn-secondary" (click)="deleteStep = 'summary'">Back</button>
                <button type="button" class="btn-danger" (click)="deleteTrainer('complete_all')" [disabled]="deletingTrainer">
                  {{ deletingTrainer ? 'Processing...' : 'Confirm & Delete' }}
                </button>
              </ng-container>

              <ng-container *ngIf="deleteStep === 'reassign'">
                <button type="button" class="btn-secondary" (click)="deleteStep = 'summary'">Back</button>
                <button
                  type="button"
                  class="btn-danger"
                  (click)="deleteTrainer('reassign')"
                  [disabled]="!reassignToTrainerId || deletingTrainer">
                  {{ deletingTrainer ? 'Processing...' : 'Reassign & Delete' }}
                </button>
              </ng-container>
            </div>

            <div class="form-actions" *ngIf="!deletePreviewLoading && trainerToDelete?.is_active">
              <button type="button" class="btn-secondary" (click)="closeDeleteModal()">Close</button>
            </div>
          </div>
        </div>
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
    .trainers-page { max-width: 1400px; margin: 0 auto; }
    .admin-data-table { min-width: 760px; }
    .admin-table-container { -webkit-overflow-scrolling: touch; }
    .email-cell { font-size: 12px; color: #6b7280; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .specialization-cell { max-width: 200px; }
    .specialization-text {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
      font-size: 13px;
      color: #374151;
    }
    .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; display: inline-block; }
    .status-badge { background: #fee2e2; color: #991b1b; }
    .status-badge.active { background: #d1fae5; color: #065f46; }
    .action-buttons { display: flex; gap: 6px; align-items: center; }

    .btn-action {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: transparent;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .btn-action .icon {
      width: 14px;
      height: 14px;
      stroke-width: 2;
    }

    .btn-edit {
      border-color: #0066B1;
      color: #0066B1;
    }

    .btn-edit:hover {
      background: #0066B1;
      color: white;
      box-shadow: 0 2px 6px rgba(0, 102, 177, 0.25);
      transform: translateY(-1px);
    }

    .btn-disable {
      border-color: #9CA3AF;
      color: #6B7280;
    }

    .btn-disable:hover {
      background: #6B7280;
      border-color: #6B7280;
      color: white;
      box-shadow: 0 2px 6px rgba(107, 114, 128, 0.25);
      transform: translateY(-1px);
    }

    .btn-delete {
      border-color: #EF4444;
      color: #EF4444;
    }

    .btn-delete:hover:not(:disabled) {
      background: #EF4444;
      color: white;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
      transform: translateY(-1px);
    }

    .btn-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-danger {
      padding: 10px 20px;
      background: #EF4444;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .warning-text {
      color: #92400E;
      font-size: 13px;
      margin-top: 12px;
      padding: 8px;
      background: #FEF3C7;
      border-radius: 4px;
    }

    .past-warning {
      color: #9a3412;
      font-size: 14px;
      margin-top: 12px;
      padding: 10px 12px;
      background: #ffedd5;
      border: 1px solid #fdba74;
      border-radius: 6px;
    }

    .btn-past {
      background: #ea580c;
    }

    .btn-past:hover {
      background: #c2410c;
    }

    .delete-modal {
      max-width: 640px;
    }

    .delete-loading {
      padding: 24px 0;
      text-align: center;
      color: #6b7280;
    }

    .booking-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 16px 0;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
    }

    .stat-item span {
      color: #6b7280;
    }

    .stat-item strong {
      color: #111827;
      font-size: 18px;
    }

    .reassign-select {
      width: 100%;
      max-width: 100%;
      min-width: 100%;
    }

    .form-help {
      margin-top: 8px;
      font-size: 12px;
      color: #6b7280;
    }

    .btn-primary {
      padding: 10px 20px;
      background: #0066B1;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

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

    @media (max-width: 768px) {
      .admin-page-header {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .admin-page-actions {
        width: 100%;
      }

      .admin-page-actions .admin-btn {
        width: 100%;
      }

      .admin-filters-content {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-search-group,
      .admin-select {
        width: 100%;
        max-width: 100%;
        min-width: 100%;
      }

      .modal-content {
        width: calc(100% - 24px);
        margin: 12px;
      }

      .form-actions {
        flex-direction: column-reverse;
        flex-wrap: wrap;
      }

      .form-actions button {
        width: 100%;
      }

      .booking-stats {
        grid-template-columns: 1fr;
      }

      .admin-pagination {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-pagination-info {
        justify-content: space-between;
      }
    }

  `]
})
export class AdminTrainersComponent implements OnInit {
  trainers: Trainer[] = [];
  filteredTrainers: Trainer[] = [];
  showModal = false;
  showDeleteModal = false;
  deletingTrainer = false;
  deletePreviewLoading = false;
  deletePreview: TrainerDeletePreview | null = null;
  deleteStep: 'summary' | 'complete_past_confirm' | 'complete_confirm' | 'reassign' = 'summary';
  reassignToTrainerId = '';
  trainerToDelete: Trainer | null = null;
  editingTrainer: Trainer | null = null;
  specializationInput = '';
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  sortBy: 'none' | 'rating' | 'experience' = 'none';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 8; // Fixed to 8 records per page
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
    } catch {
      this.toastService.error('Failed to load trainers');
    }
  }

  filterTrainers() {
    let filtered = [...this.trainers];
    
    // Search filter
    const term = this.searchTerm.toLowerCase().trim();
    if (term) {
      filtered = filtered.filter(trainer => 
        trainer.profile?.full_name?.toLowerCase().includes(term) ||
        trainer.profile?.email?.toLowerCase().includes(term) ||
        trainer.specialization?.some(s => s.toLowerCase().includes(term))
      );
    }
    
    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(trainer => 
        this.statusFilter === 'active' ? trainer.is_active : !trainer.is_active
      );
    }
    
    // Sort
    if (this.sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortBy === 'experience') {
      filtered.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
    }
    
    this.filteredTrainers = filtered;
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

  getStartIndex(): number {
    return this.filteredTrainers.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  getEndIndex(): number {
    const end = this.currentPage * this.itemsPerPage;
    return end > this.filteredTrainers.length ? this.filteredTrainers.length : end;
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
        await firstValueFrom(this.adminService.updateTrainer(this.editingTrainer.id, data));
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
        await firstValueFrom(this.adminService.createTrainer(data));
      }

      this.showModal = false;
      await this.loadTrainers();
      this.toastService.success(this.editingTrainer ? 'Trainer updated successfully' : 'Trainer created successfully');
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to save trainer'));
    }
  }

  async toggleActive(trainerId: string, currentStatus: boolean) {
    try {
      await firstValueFrom(this.adminService.updateTrainer(trainerId, { is_active: !currentStatus }));
      await this.loadTrainers();
      this.toastService.success(`Trainer ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to update trainer status'));
    }
  }

  async confirmDelete(trainer: Trainer) {
    this.trainerToDelete = trainer;
    this.deleteStep = 'summary';
    this.reassignToTrainerId = '';
    this.deletePreview = null;
    this.showDeleteModal = true;

    if (trainer.is_active) {
      return;
    }

    this.deletePreviewLoading = true;
    try {
      this.deletePreview = await firstValueFrom(
        this.adminService.getTrainerDeletePreview(trainer.id)
      );
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to load trainer booking summary'));
      this.closeDeleteModal();
    } finally {
      this.deletePreviewLoading = false;
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.trainerToDelete = null;
    this.deletePreview = null;
    this.deleteStep = 'summary';
    this.reassignToTrainerId = '';
    this.deletePreviewLoading = false;
  }

  getPastBookingsWarning(): string {
    const count = this.deletePreview?.pastBlockingBookings ?? 0;
    if (count <= 0) {
      return '';
    }
    const label = count === 1 ? 'booking' : 'bookings';
    const verb = count === 1 ? 'is' : 'are';
    return `${count} ${label} appear to be in the past but ${verb} not marked completed.`;
  }

  async refreshDeletePreview() {
    if (!this.trainerToDelete) {
      return;
    }
    this.deletePreviewLoading = true;
    try {
      this.deletePreview = await firstValueFrom(
        this.adminService.getTrainerDeletePreview(this.trainerToDelete.id)
      );
      this.deleteStep = 'summary';
    } catch (error: unknown) {
      this.toastService.error(getApiErrorMessage(error, 'Failed to refresh booking summary'));
    } finally {
      this.deletePreviewLoading = false;
    }
  }

  async deleteTrainer(strategy: 'direct' | 'complete_all' | 'complete_past' | 'reassign') {
    if (!this.trainerToDelete || this.trainerToDelete.is_active) {
      return;
    }

    if (strategy === 'reassign' && !this.reassignToTrainerId) {
      this.toastService.error('Please select a trainer to reassign bookings to');
      return;
    }

    this.deletingTrainer = true;
    try {
      const result = await firstValueFrom(
        this.adminService.deleteTrainer(this.trainerToDelete.id, {
          strategy,
          reassignToTrainerId: strategy === 'reassign' ? this.reassignToTrainerId : undefined
        })
      );

      if (result?.deleted === false) {
        this.toastService.success(result.message || 'Past bookings marked as completed');
        await this.refreshDeletePreview();
        return;
      }

      let message = result?.message || 'Trainer deleted successfully';
      if (strategy === 'complete_all' && result?.updatedCount > 0) {
        message = `Marked ${result.updatedCount} booking(s) as completed and deleted trainer`;
      } else if (strategy === 'reassign' && result?.reassignedCount > 0) {
        message = `Reassigned ${result.reassignedCount} booking(s) and deleted trainer`;
      }

      this.closeDeleteModal();
      await this.loadTrainers();
      this.toastService.success(message);
    } catch (error: unknown) {
      this.toastService.error(
        getApiErrorMessage(error, 'This trainer has existing bookings. Please complete or reassign them before deleting.')
      );
    } finally {
      this.deletingTrainer = false;
    }
  }
}
