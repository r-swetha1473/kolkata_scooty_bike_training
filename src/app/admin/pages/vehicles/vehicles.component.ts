import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';

interface Vehicle {
  id: string;
  name: string;
  max_per_slot: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-admin-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="vehicles-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Manage Vehicles</h1>
        <div class="admin-page-actions">
          <button class="admin-btn admin-btn-primary" (click)="showCreateModal()">+ Add Vehicle</button>
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
              (input)="filterVehicles()"
              placeholder="Search vehicle name..." 
              class="admin-search-input">
          </div>
          <div class="admin-filter-group">
            <select [(ngModel)]="statusFilter" (change)="filterVehicles()" class="admin-select">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div class="admin-table-container">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Max Per Slot</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let vehicle of getPaginatedVehicles()">
              <td><strong>{{ vehicle.name }}</strong></td>
              <td>{{ vehicle.max_per_slot }}</td>
              <td>
                <span class="status-badge" [class.active]="vehicle.is_active">
                  {{ vehicle.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>{{ formatDate(vehicle.created_at) }}</td>
              <td>
                <div class="action-buttons">
                  <button
                    class="btn-action btn-edit"
                    (click)="showEditModal(vehicle)"
                    title="Edit">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    class="btn-action btn-disable"
                    (click)="toggleActive(vehicle.id, vehicle.is_active)"
                    [title]="vehicle.is_active ? 'Deactivate' : 'Activate'">
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" *ngIf="vehicle.is_active">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                    <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" *ngIf="!vehicle.is_active">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </button>
                  <button
                    class="btn-action btn-delete"
                    (click)="confirmDelete(vehicle)"
                    title="Delete"
                    [disabled]="vehicle.is_active">
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

        <div *ngIf="getPaginatedVehicles().length === 0" class="empty-state">
          <p>No vehicles found</p>
        </div>
      </div>

      <!-- Pagination -->
      <div class="admin-pagination" *ngIf="filteredVehicles.length > itemsPerPage">
        <button 
          class="pagination-btn" 
          (click)="currentPage = currentPage - 1" 
          [disabled]="currentPage === 1">
          Previous
        </button>
        <span class="pagination-info">
          Page {{ currentPage }} of {{ getTotalPages() }}
        </span>
        <button 
          class="pagination-btn" 
          (click)="currentPage = currentPage + 1" 
          [disabled]="currentPage >= getTotalPages()">
          Next
        </button>
      </div>

      <!-- Create/Edit Modal -->
      <div *ngIf="showModal" class="modal-overlay" (click)="closeModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>{{ editingVehicle ? 'Edit Vehicle' : 'Create Vehicle' }}</h2>
          <form (ngSubmit)="saveVehicle()">
            <div class="form-group">
              <label>Vehicle Name *</label>
              <input 
                type="text" 
                [(ngModel)]="formVehicle.name" 
                name="name"
                placeholder="e.g., Electric Scooty"
                required
                class="form-input">
            </div>
            <div class="form-group">
              <label>Max Per Slot *</label>
              <input 
                type="number" 
                [(ngModel)]="formVehicle.max_per_slot" 
                name="max_per_slot"
                min="1"
                max="10"
                required
                class="form-input">
              <p class="form-help">Maximum number of this vehicle type that can be booked per slot</p>
            </div>
            <div class="form-group">
              <label>
                <input 
                  type="checkbox" 
                  [(ngModel)]="formVehicle.is_active" 
                  name="is_active">
                Active
              </label>
              <p class="form-help">Inactive vehicles cannot be selected for bookings</p>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div *ngIf="showDeleteModal" class="modal-overlay" (click)="showDeleteModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Delete Vehicle</h2>
          <p>Are you sure you want to delete <strong>{{ vehicleToDelete?.name }}</strong>?</p>
          <p class="warning-text" *ngIf="vehicleToDelete?.is_active">
            ⚠️ This vehicle is currently active. Please deactivate it first before deleting.
          </p>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="showDeleteModal = false">Cancel</button>
            <button 
              type="button" 
              class="btn-danger" 
              (click)="deleteVehicle()"
              [disabled]="vehicleToDelete?.is_active">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vehicles-page {
      max-width: 1400px;
      margin: 0 auto;
    }

    .admin-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .admin-page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--admin-text);
      margin: 0;
    }

    .admin-page-actions {
      display: flex;
      gap: 12px;
    }

    .admin-btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .admin-btn-primary {
      background: var(--admin-primary);
      color: white;
    }

    .admin-btn-primary:hover {
      background: var(--admin-primary-dark);
      transform: translateY(-1px);
    }

    .admin-filters-bar {
      background: white;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .admin-filters-content {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .admin-filter-group {
      display: flex;
      align-items: center;
    }

    .admin-search-group {
      flex: 1;
      max-width: 33%;
      position: relative;
    }

    .admin-search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--admin-text-secondary);
    }

    .admin-search-input {
      width: 100%;
      padding: 10px 12px 10px 36px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      font-size: 14px;
    }

    .admin-select {
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      font-size: 14px;
      min-width: 150px;
    }

    .admin-table-container {
      -webkit-overflow-scrolling: touch;
    }

    .admin-data-table {
      min-width: 640px;
    }

    .admin-data-table {
      width: 100%;
      border-collapse: collapse;
    }

    .admin-data-table thead {
      background: #F9FAFB;
      border-bottom: 2px solid var(--admin-border);
    }

    .admin-data-table th {
      padding: 16px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      color: var(--admin-text);
    }

    .admin-data-table td {
      padding: 16px;
      border-bottom: 1px solid var(--admin-border);
      font-size: 14px;
    }

    .admin-data-table tbody tr:hover {
      background: #F9FAFB;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #FEE2E2;
      color: #991B1B;
    }

    .status-badge.active {
      background: #D1FAE5;
      color: #065F46;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .btn-action {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--admin-border);
      background: white;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-action:hover:not(:disabled) {
      background: #F9FAFB;
      border-color: var(--admin-primary);
    }

    .btn-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-action.btn-delete:hover:not(:disabled) {
      border-color: #EF4444;
      background: #FEE2E2;
    }

    .empty-state {
      padding: 48px;
      text-align: center;
      color: var(--admin-text-secondary);
    }

    .admin-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 24px;
    }

    .pagination-btn {
      padding: 8px 16px;
      border: 1px solid var(--admin-border);
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-info {
      font-size: 14px;
      color: var(--admin-text-secondary);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      padding: 32px;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: var(--admin-text);
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      font-size: 14px;
    }

    .form-help {
      margin-top: 6px;
      font-size: 12px;
      color: var(--admin-text-secondary);
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    .btn-secondary {
      padding: 10px 20px;
      border: 1px solid var(--admin-border);
      background: white;
      border-radius: 8px;
      cursor: pointer;
    }

    .btn-primary {
      padding: 10px 20px;
      background: var(--admin-primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }

    .btn-danger {
      padding: 10px 20px;
      background: #EF4444;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
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

      .admin-search-group {
        max-width: 100%;
      }

      .admin-select {
        width: 100%;
        min-width: 100%;
      }

      .modal-content {
        width: calc(100% - 24px);
        padding: 20px;
        margin: 12px;
      }

      .modal-actions {
        flex-direction: column-reverse;
      }

      .modal-actions button {
        width: 100%;
      }

      .admin-pagination {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
  `]
})
export class AdminVehiclesComponent implements OnInit {
  vehicles: Vehicle[] = [];
  filteredVehicles: Vehicle[] = [];
  searchTerm = '';
  statusFilter = 'all';
  currentPage = 1;
  itemsPerPage = 10;
  showModal = false;
  showDeleteModal = false;
  editingVehicle: Vehicle | null = null;
  vehicleToDelete: Vehicle | null = null;

  formVehicle: Partial<Vehicle> = {
    name: '',
    max_per_slot: 1,
    is_active: true
  };

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) {}

  async ngOnInit() {
    await this.loadVehicles();
  }

  async loadVehicles() {
    try {
      const result = await this.api.get<Vehicle[]>('/vehicles?include_inactive=true');
      this.vehicles = Array.isArray(result) ? result : [];
      this.filterVehicles();
    } catch (error: unknown) {
      this.toast.error(getApiErrorMessage(error, 'Failed to load vehicles'));
    }
  }

  filterVehicles() {
    let filtered = [...this.vehicles];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (this.statusFilter === 'active') {
      filtered = filtered.filter(v => v.is_active);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(v => !v.is_active);
    }

    this.filteredVehicles = filtered;
    this.currentPage = 1;
  }

  getPaginatedVehicles(): Vehicle[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredVehicles.slice(start, end);
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredVehicles.length / this.itemsPerPage);
  }

  showCreateModal() {
    this.editingVehicle = null;
    this.formVehicle = {
      name: '',
      max_per_slot: 1,
      is_active: true
    };
    this.showModal = true;
  }

  showEditModal(vehicle: Vehicle) {
    this.editingVehicle = vehicle;
    this.formVehicle = {
      name: vehicle.name,
      max_per_slot: vehicle.max_per_slot,
      is_active: vehicle.is_active
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingVehicle = null;
    this.formVehicle = {
      name: '',
      max_per_slot: 1,
      is_active: true
    };
  }

  private buildVehiclePayload(): { name: string; max_per_slot: number; is_active: boolean } {
    const name = (this.formVehicle.name || '').trim();
    const maxPerSlot = parseInt(String(this.formVehicle.max_per_slot ?? ''), 10);

    if (!name) {
      throw new Error('Vehicle name is required');
    }
    if (!Number.isFinite(maxPerSlot) || maxPerSlot < 1) {
      throw new Error('Max per slot must be at least 1');
    }

    return {
      name,
      max_per_slot: maxPerSlot,
      is_active: Boolean(this.formVehicle.is_active)
    };
  }

  async saveVehicle() {
    try {
      const payload = this.buildVehiclePayload();

      if (this.editingVehicle) {
        await this.api.put(`/vehicles/${this.editingVehicle.id}`, payload);
        this.toast.success('Vehicle updated successfully');
      } else {
        await this.api.post('/vehicles', payload);
        this.toast.success('Vehicle created successfully');
      }
      this.closeModal();
      await this.loadVehicles();
    } catch (error: unknown) {
      if (error instanceof Error && !('error' in error)) {
        this.toast.error(error.message);
        return;
      }
      this.toast.error(getApiErrorMessage(error, 'Failed to save vehicle'));
    }
  }

  async toggleActive(id: string, currentStatus: boolean) {
    try {
      await this.api.put(`/vehicles/${id}`, { is_active: !currentStatus });
      this.toast.success(`Vehicle ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      await this.loadVehicles();
    } catch (error: unknown) {
      this.toast.error(getApiErrorMessage(error, 'Failed to update vehicle status'));
    }
  }

  confirmDelete(vehicle: Vehicle) {
    this.vehicleToDelete = vehicle;
    this.showDeleteModal = true;
  }

  async deleteVehicle() {
    if (!this.vehicleToDelete) return;

    try {
      await this.api.delete(`/vehicles/${this.vehicleToDelete.id}`);
      this.toast.success('Vehicle deleted successfully');
      this.showDeleteModal = false;
      this.vehicleToDelete = null;
      await this.loadVehicles();
    } catch (error: unknown) {
      this.toast.error(getApiErrorMessage(error, 'Failed to delete vehicle'));
    }
  }

  formatDate(date: string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }
}
