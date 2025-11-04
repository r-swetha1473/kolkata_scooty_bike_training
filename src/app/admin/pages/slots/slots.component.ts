import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../../services/slot.service';
import { TrainerService, Trainer } from '../../../services/trainer.service';

@Component({
  selector: 'app-admin-slots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="slots-page">
      <div class="page-header">
        <h1 class="page-title">Manage Slots</h1>
        <div class="header-actions">
          <input 
            type="date" 
            [(ngModel)]="slotGenerationDate" 
            class="date-filter">
          <button class="btn-primary" (click)="generateSlots()">🔄 Generate Daily Slots</button>
          <select [(ngModel)]="selectedDate" (change)="loadSlotsByDate()" class="date-filter">
            <option value="">All Dates</option>
            <option *ngFor="let date of availableDates" [value]="date">{{ date }}</option>
          </select>
          <button class="btn-primary" (click)="showCreateModal = true">+ Create Slot</button>
        </div>
      </div>

      <div class="view-toggle">
        <button [class.active]="viewMode === 'list'" (click)="viewMode = 'list'">📋 List View</button>
        <button [class.active]="viewMode === 'calendar'" (click)="viewMode = 'calendar'">📅 Calendar View</button>
      </div>

      <div *ngIf="viewMode === 'list'" class="slots-list-container">
        <div class="filters-bar">
          <input 
            type="text" 
            [(ngModel)]="searchTerm" 
            (input)="filterSlots()"
            placeholder="Search by trainer name or time..." 
            class="search-input">
          <select [(ngModel)]="statusFilter" (change)="filterSlots()" class="filter-select">
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="full">Full</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
          <select [(ngModel)]="itemsPerPage" (change)="onPageSizeChange()" class="page-size-select">
            <option [value]="10">10 per page</option>
            <option [value]="20">20 per page</option>
            <option [value]="50">50 per page</option>
            <option [value]="100">100 per page</option>
          </select>
        </div>

        <div *ngIf="filteredSlots.length === 0" class="empty-state">No slots found. Generate daily slots to get started.</div>
        <div *ngFor="let slot of getPaginatedSlots()" class="slot-card">
          <div class="slot-info">
            <div class="slot-time">{{ formatDateTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}</div>
            <div class="slot-trainer" *ngIf="slot.trainer">
              Trainer: {{ slot.trainer.profile?.full_name }}
              <button class="btn-link" (click)="unassignTrainer(slot.id)">✕ Unassign</button>
            </div>
            <div class="slot-trainer" *ngIf="!slot.trainer">
              <span class="unassigned">Unassigned</span>
              <button class="btn-link" (click)="openAssignTrainer(slot)">+ Assign Trainer</button>
            </div>
            <div class="slot-capacity">Capacity: {{ slot.booked_count }} / {{ slot.capacity }}</div>
            <div class="slot-status-row">
              <span class="status-badge" [class]="'status-' + slot.status">
                <span class="status-icon" *ngIf="slot.status === 'available'">🟢</span>
                <span class="status-icon" *ngIf="slot.status === 'full'">🔴</span>
                <span class="status-icon" *ngIf="slot.status === 'cancelled'">⚪</span>
                <span class="status-icon" *ngIf="slot.status === 'disabled'">⚪</span>
                <span class="status-icon" *ngIf="slot.status === 'completed'">✅</span>
                {{ slot.status }}
              </span>
              <span class="auto-tag" *ngIf="slot.is_auto_generated">Auto-generated</span>
            </div>
          </div>
          <div class="slot-actions">
            <button class="btn-edit" (click)="editSlot(slot)" [disabled]="slot.booked_count > 0">✏️ Edit</button>
            <button class="btn-link" (click)="toggleSlotEnable(slot)" [class.active]="slot.status === 'available'" [class.disabled]="slot.status === 'disabled'">
              {{ slot.status === 'disabled' ? '⚪ Disabled' : slot.status === 'available' ? '🟢 Enabled' : '○ Inactive' }}
            </button>
            <button class="btn-link" (click)="openAssignTrainer(slot)">👤 {{ slot.trainer ? 'Change Trainer' : 'Assign Trainer' }}</button>
            <button class="btn-delete" (click)="deleteSlot(slot.id)" [disabled]="slot.booked_count > 0">🗑️ Delete</button>
          </div>
        </div>

        <div class="pagination-container" *ngIf="totalPages > 1">
          <button 
            class="pagination-btn" 
            [disabled]="currentPage === 1"
            (click)="goToPage(currentPage - 1)">
            ← Previous
          </button>
          <span class="page-info">
            Page {{ currentPage }} of {{ totalPages }} ({{ filteredSlots.length }} slots)
          </span>
          <button 
            class="pagination-btn" 
            [disabled]="currentPage === totalPages"
            (click)="goToPage(currentPage + 1)">
            Next →
          </button>
        </div>
      </div>

      <div *ngIf="viewMode === 'calendar'" class="calendar-view">
        <div class="calendar-header">
          <button (click)="previousWeek()">← Previous</button>
          <span>{{ currentWeekDisplay }}</span>
          <button (click)="nextWeek()">Next →</button>
        </div>
        <div class="calendar-grid">
          <div *ngFor="let day of calendarDays" class="day-column">
            <div class="day-header">{{ day.label }}</div>
            <div class="day-slots">
              <div *ngFor="let slot of day.slots" class="calendar-slot" [class.assigned]="slot.trainer_id" [class.booked]="slot.booked_count >= slot.capacity" (click)="openAssignTrainer(slot)">
                <div class="slot-time-compact">{{ formatTimeOnly(slot.start_time) }}</div>
                <div class="slot-trainer-compact" *ngIf="slot.trainer">
                  {{ slot.trainer.profile?.full_name }}
                </div>
                <div class="slot-trainer-compact unassigned" *ngIf="!slot.trainer">Unassigned</div>
                <div class="slot-capacity-compact">{{ slot.booked_count }}/{{ slot.capacity }}</div>
                <div class="slot-status-compact" [class]="'status-' + slot.status">{{ slot.status }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="showCreateModal" class="modal-overlay" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Create New Slot</h2>
          <form (ngSubmit)="createSlot()">
            <div class="form-group">
              <label>Trainer (Optional)</label>
              <select [(ngModel)]="newSlot.trainer_id" name="trainer">
                <option value="">Unassigned</option>
                <option *ngFor="let trainer of onDutyTrainers" [value]="trainer.id">
                  {{ trainer.profile?.full_name }} ({{ trainer.on_duty ? 'On Duty' : 'Off Duty' }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Start Time</label>
              <input type="datetime-local" [(ngModel)]="newSlot.start_time" name="start" required>
            </div>
            <div class="form-group">
              <label>End Time</label>
              <input type="datetime-local" [(ngModel)]="newSlot.end_time" name="end" required>
            </div>
            <div class="form-group">
              <label>Capacity</label>
              <input type="number" [(ngModel)]="newSlot.capacity" name="capacity" min="1" required>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="showCreateModal = false">Cancel</button>
              <button type="submit" class="btn-primary">Create</button>
            </div>
          </form>
        </div>
      </div>

      <div *ngIf="showAssignModal" class="modal-overlay" (click)="showAssignModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Assign Trainer</h2>
            <div class="form-group">
              <label>Select Trainer</label>
              <select [(ngModel)]="selectedTrainerId" name="trainer">
                <option [value]="">Unassign Trainer</option>
                <option *ngFor="let trainer of onDutyTrainers" [value]="trainer.id">
                  {{ trainer.profile?.full_name }} {{ trainer.on_duty ? '(On Duty)' : '(Off Duty)' }}
                </option>
              </select>
              <p class="form-help" *ngIf="selectedSlot">
                Current: {{ selectedSlot.trainer?.profile?.full_name || 'No trainer assigned' }}
              </p>
            </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="showAssignModal = false">Cancel</button>
            <button type="button" class="btn-primary" (click)="assignTrainerToSlot()">Assign</button>
          </div>
        </div>
      </div>

      <div *ngIf="showEditModal" class="modal-overlay" (click)="showEditModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Edit Slot</h2>
          <form (ngSubmit)="updateSlot()">
            <div class="form-group">
              <label>Start Time</label>
              <input type="datetime-local" [(ngModel)]="editingSlot.start_time" name="start" required>
            </div>
            <div class="form-group">
              <label>End Time</label>
              <input type="datetime-local" [(ngModel)]="editingSlot.end_time" name="end" required>
            </div>
            <div class="form-group">
              <label>Capacity</label>
              <input type="number" [(ngModel)]="editingSlot.capacity" name="capacity" min="1" required>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select [(ngModel)]="editingSlot.status" name="status" required>
                <option value="available">Available</option>
                <option value="full">Full</option>
                <option value="disabled">Disabled</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="showEditModal = false">Cancel</button>
              <button type="submit" class="btn-primary">Update</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .slots-page { max-width: 1400px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin: 0; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
    .date-filter { padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .btn-primary { padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: transform 0.2s; }
    .btn-primary:hover { transform: translateY(-2px); }
    .view-toggle { display: flex; gap: 12px; margin-bottom: 24px; }
    .view-toggle button { padding: 10px 20px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .view-toggle button.active { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-color: #3b82f6; }
    .empty-state { padding: 60px; text-align: center; color: #6b7280; background: white; border-radius: 12px; }
    .slots-list { display: grid; gap: 16px; }
    .slot-card { background:#eafff0; padding:18px; border-radius:16px; border:2px solid #22c55e; display:flex; justify-content:space-between; align-items:center; gap:16px; }
    .slot-card:hover { box-shadow:0 8px 24px rgba(0,0,0,.08); }
    .slot-time { font-weight:800; font-size:20px; margin-bottom: 8px; color: #0f172a; }
    .slot-trainer, .slot-capacity { font-size: 14px; color: #6b7280; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .unassigned { color: #dc2626; font-weight: 600; }
    .btn-link { background: none; border: none; color: #3b82f6; cursor: pointer; text-decoration: underline; font-size: 13px; padding: 4px 8px; }
    .btn-link:hover { background: #eff6ff; border-radius: 4px; }
    .btn-link.active { color: #059669; font-weight: 600; }
    .btn-link:disabled, .btn-edit:disabled, .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
    .slot-status-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .status-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
    .status-icon { font-size: 14px; }
    .status-available { background:#dcfce7; color:#065f46; border:1px solid #22c55e; }
    .status-full { background: #fee2e2; color: #991b1b; }
    .status-cancelled, .status-disabled { background:#f1f5f9; color:#64748b; }
    .status-completed { background: #e0e7ff; color: #3730a3; }
    .auto-tag { padding: 4px 8px; background: #f3f4f6; color: #6b7280; border-radius: 8px; font-size: 11px; }
    .slot-actions { display: flex; gap: 8px; }
    .btn-edit, .btn-delete { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
    .btn-edit { background: #dbeafe; color: #1e40af; }
    .btn-edit:hover { background: #bfdbfe; }
    .btn-delete { background: #fee2e2; color: #991b1b; }
    .btn-delete:hover { background: #fecaca; }
    .calendar-view { background: white; padding: 24px; border-radius: 12px; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .calendar-header button { padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 16px; }
    .day-column { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .day-header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px; text-align: center; font-weight: 600; }
    .day-slots { padding: 8px; max-height: 400px; overflow-y: auto; }
    .calendar-slot { padding: 8px; margin-bottom: 8px; border-radius: 6px; background: #f9fafb; border-left: 3px solid #e5e7eb; cursor: pointer; transition: all 0.2s; }
    .calendar-slot:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .calendar-slot.assigned { border-left-color: #10b981; background: #d1fae5; }
    .calendar-slot.booked { border-left-color: #f59e0b; background: #fef3c7; }
    .slot-time-compact { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
    .slot-trainer-compact { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
    .slot-trainer-compact.unassigned { color: #dc2626; font-weight: 600; }
    .slot-capacity-compact { font-size: 10px; color: #6b7280; margin-top: 4px; }
    .slot-status-compact { font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block; }
    .slot-status-compact.status-available { background: #d1fae5; color: #065f46; }
    .slot-status-compact.status-full { background: #fee2e2; color: #991b1b; }
    .slot-status-compact.status-cancelled { background: #fef3c7; color: #92400e; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 32px; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .form-help { margin-top: 8px; font-size: 12px; color: #6b7280; }
    .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
    .btn-secondary { padding: 12px 24px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
    .filters-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 200px; padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .search-input:focus { outline: none; border-color: #3b82f6; }
    .filter-select, .page-size-select { padding: 10px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .pagination-container { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 24px; padding: 20px; }
    .pagination-btn { padding: 10px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .pagination-btn:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
    .pagination-btn:not(:disabled):hover { transform: translateY(-2px); }
    .page-info { color: #6b7280; font-size: 14px; }
    .slots-list-container { display: flex; flex-direction: column; }
  `]
})
export class AdminSlotsComponent implements OnInit {
  slots: Slot[] = [];
  allSlots: Slot[] = [];
  filteredSlots: Slot[] = [];
  trainers: Trainer[] = [];
  onDutyTrainers: Trainer[] = [];
  showCreateModal = false;
  showAssignModal = false;
  showEditModal = false;
  selectedDate = '';
  availableDates: string[] = [];
  viewMode: 'list' | 'calendar' = 'list';
  calendarDays: any[] = [];
  currentWeekStart = new Date();
  selectedTrainerId = '';
  selectedSlot: any = null;
  newSlot = { trainer_id: '', start_time: '', end_time: '', capacity: 1 };
  editingSlot: any = { id: '', start_time: '', end_time: '', capacity: 1, status: 'available' };
  
  // Search and pagination
  searchTerm = '';
  statusFilter = '';
  currentPage = 1;
  itemsPerPage = 20;
  totalPages = 1;
  slotGenerationDate = '';

  constructor(
    private slotService: SlotService,
    private trainerService: TrainerService
  ) {}

  getDefaultDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async ngOnInit() {
    this.slotGenerationDate = this.getDefaultDate();
    await this.loadData();
  }

  async loadData() {
    try {
      this.trainers = await this.trainerService.getAllTrainers();
      this.onDutyTrainers = await this.trainerService.getOnDutyTrainers();
      await this.loadSlots();
      this.updateAvailableDates();
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.filteredSlots = [];
      this.updatePagination();
    }
  }

  async loadSlots() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      const end = endDate.toISOString().split('T')[0];
      this.allSlots = await this.slotService.getSlotsByDateRange(today, end);
      // Default to showing today's slots
      if (!this.selectedDate) {
        this.selectedDate = today;
      }
      this.slots = this.allSlots;
      this.filterSlots();
    } catch (error) {
      console.error('Failed to load slots:', error);
    }
  }

  async loadSlotsByDate() {
    if (this.selectedDate) {
      this.slots = this.allSlots.filter(s => s.slot_date === this.selectedDate);
    } else {
      this.slots = this.allSlots;
    }
    this.filterSlots();
    if (this.viewMode === 'calendar') {
      this.updateCalendar();
    }
  }

  filterSlots() {
    let filtered = [...this.slots];
    
    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(slot => {
        const trainerName = slot.trainer?.profile?.full_name?.toLowerCase() || '';
        const time = new Date(slot.start_time).toLocaleString().toLowerCase();
        return trainerName.includes(term) || time.includes(term);
      });
    }
    
    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(slot => slot.status === this.statusFilter);
    }
    
    this.filteredSlots = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredSlots.length / this.itemsPerPage);
  }

  getPaginatedSlots(): Slot[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredSlots.slice(start, end);
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

  updateAvailableDates() {
    const dates = new Set<string>();
    this.allSlots.forEach(slot => dates.add(slot.slot_date));
    this.availableDates = Array.from(dates).sort();
  }

  async generateSlots() {
    try {
      const date = this.slotGenerationDate || this.getDefaultDate();
      const result = await this.slotService.generateDailySlots(date);
      
      // Show success message
      const message = result.message || result.success === false 
        ? result.message 
        : `Successfully generated ${result.slotsCreated || 24} slots for ${date}`;
      alert(message);
      
      // Refresh slots data immediately
      await this.loadSlots();
      this.selectedDate = date;
      await this.loadSlotsByDate();
      // Update available dates
      this.updateAvailableDates();
      // Update calendar if in calendar view
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error: any) {
      console.error('Generate slots error:', error);
      alert(error?.error?.message || error?.message || 'Failed to generate slots');
    }
  }

  async createSlot() {
    try {
      await this.slotService.createSlot({
        trainer_id: this.newSlot.trainer_id || null,
        start_time: new Date(this.newSlot.start_time).toISOString(),
        end_time: new Date(this.newSlot.end_time).toISOString(),
        capacity: this.newSlot.capacity,
        status: 'available',
        is_auto_generated: false
      } as any);
      this.showCreateModal = false;
      this.newSlot = { trainer_id: '', start_time: '', end_time: '', capacity: 1 };
      await this.loadData();
    } catch (error) {
      alert('Failed to create slot');
    }
  }

  editSlot(slot: Slot) {
    this.editingSlot = {
      id: slot.id,
      start_time: slot.start_time.substring(0, 16),
      end_time: slot.end_time.substring(0, 16),
      capacity: slot.capacity,
      status: slot.status
    };
    this.showEditModal = true;
  }

  async updateSlot() {
    try {
      await this.slotService.updateSlot(this.editingSlot.id, {
        start_time: new Date(this.editingSlot.start_time).toISOString(),
        end_time: new Date(this.editingSlot.end_time).toISOString(),
        capacity: this.editingSlot.capacity,
        status: this.editingSlot.status
      });
      this.showEditModal = false;
      await this.loadData();
    } catch (error) {
      alert('Failed to update slot');
    }
  }

  openAssignTrainer(slot: Slot) {
    this.selectedSlot = slot;
    this.showAssignModal = true;
  }

  async assignTrainerToSlot() {
    if (!this.selectedSlot) return;
    try {
      if (this.selectedTrainerId) {
        await this.slotService.assignTrainer(this.selectedSlot.id, this.selectedTrainerId);
      } else {
        await this.slotService.unassignTrainer(this.selectedSlot.id);
      }
      // Update local slot immediately for real-time UI
      const slotIndex = this.allSlots.findIndex(s => s.id === this.selectedSlot.id);
      if (slotIndex !== -1) {
        if (this.selectedTrainerId) {
          const trainer = this.onDutyTrainers.find(t => t.id === this.selectedTrainerId);
          if (trainer && trainer.profile) {
            this.allSlots[slotIndex].trainer = {
              id: trainer.id,
              profile: {
                full_name: trainer.profile.full_name
              }
            };
            this.allSlots[slotIndex].trainer_id = trainer.id;
          }
        } else {
          this.allSlots[slotIndex].trainer = undefined;
          this.allSlots[slotIndex].trainer_id = undefined;
        }
        this.filterSlots();
      }
      this.showAssignModal = false;
      this.selectedTrainerId = '';
      this.selectedSlot = null;
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error) {
      alert('Failed to assign trainer');
      await this.loadData();
    }
  }

  async unassignTrainer(slotId: string) {
    if (!confirm('Unassign trainer from this slot?')) return;
    try {
      await this.slotService.unassignTrainer(slotId);
      // Update local slot immediately for real-time UI
      const slotIndex = this.allSlots.findIndex(s => s.id === slotId);
      if (slotIndex !== -1) {
        this.allSlots[slotIndex].trainer = undefined;
        this.allSlots[slotIndex].trainer_id = undefined;
        this.filterSlots();
      }
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error) {
      alert('Failed to unassign trainer');
      await this.loadData();
    }
  }

  async deleteSlot(id: string) {
    if (!confirm('Delete this slot?')) return;
    try {
      await this.slotService.deleteSlot(id);
      await this.loadData();
    } catch (error) {
      alert('Failed to delete slot');
    }
  }

  async toggleSlotStatus(slot: Slot) {
    try {
      const newStatus = slot.status === 'available' ? 'cancelled' : 'available';
      await this.slotService.updateSlotStatus(slot.id, newStatus);
      // Update local slot immediately for real-time UI
      const slotIndex = this.allSlots.findIndex(s => s.id === slot.id);
      if (slotIndex !== -1) {
        this.allSlots[slotIndex].status = newStatus;
        this.filterSlots();
      }
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error) {
      alert('Failed to update slot status');
      await this.loadData();
    }
  }

  async toggleSlotEnable(slot: Slot) {
    try {
      // Use the new toggle endpoint
      const response = await fetch(`${this.slotService['apiUrl']}/slots/${slot.id}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle slot');
      }
      
      const updatedSlot = await response.json();
      
      // Update local slot immediately for real-time UI
      const slotIndex = this.allSlots.findIndex(s => s.id === slot.id);
      if (slotIndex !== -1) {
        this.allSlots[slotIndex].status = updatedSlot.status;
        this.filterSlots();
      }
      if (this.viewMode === 'calendar') {
        this.updateCalendar();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to toggle slot');
      await this.loadData();
    }
  }

  updateCalendar() {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        date: dateStr,
        slots: this.slots.filter(s => s.slot_date === dateStr)
      });
    }
    this.calendarDays = days;
  }

  get currentWeekDisplay(): string {
    const start = new Date(this.currentWeekStart);
    const end = new Date(this.currentWeekStart);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  previousWeek() {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
    this.updateCalendar();
  }

  nextWeek() {
    this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
    this.updateCalendar();
  }

  formatDateTime(date: string) {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(date: string) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTimeOnly(date: string) {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
