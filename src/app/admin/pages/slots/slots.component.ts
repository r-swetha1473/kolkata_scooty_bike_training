import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../../services/slot.service';
import { TrainerService, Trainer } from '../../../services/trainer.service';
import { ToastService } from '../../../services/toast.service';
import { environment } from '../../../../environments/environment';

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
            [(ngModel)]="selectedDate" 
            (change)="onSelectedDateChange()"
            class="date-filter">
          <button class="btn-primary" (click)="showCreateModal = true">+ Create Slot</button>
        </div>
      </div>

      <div class="date-heading" *ngIf="selectedDate">
        <h2>Slots for {{ formatReadableDate(selectedDate) }}</h2>
      </div>

      <div class="slots-list-container">
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
        </div>

        <div *ngIf="filteredSlots.length === 0" class="empty-state">
          <div>No slots for {{ formatReadableDate(selectedDate) }}.</div>
          <button class="btn-primary" (click)="generateSlotsForSelectedDate()">Generate Slot</button>
        </div>
        <div class="slots-grid" *ngIf="filteredSlots.length > 0">
        <div *ngFor="let slot of filteredSlots" class="slot-card" [class.booked]="slot.booked_count > 0" (click)="openSlotPopup(slot)">
          <div class="slot-info">
            <div class="slot-time">{{ formatTimeOnly(slot.start_time) }} – {{ formatTimeOnly(slot.end_time) }}</div>
            <div class="slot-status-badge" [class]="'status-' + slot.status">
              <span class="status-icon" *ngIf="slot.status === 'available'">🟢</span>
              <span class="status-icon" *ngIf="slot.status === 'full'">🔴</span>
              <span class="status-icon" *ngIf="slot.status === 'cancelled'">⚪</span>
              <span class="status-icon" *ngIf="slot.status === 'disabled'">⚪</span>
              <span class="status-icon" *ngIf="slot.status === 'completed'">✅</span>
            </div>
            <div class="slot-trainer-name" *ngIf="slot.trainer?.profile?.full_name">
              {{ slot.trainer.profile.full_name }}
            </div>
            <div class="slot-capacity-small">{{ slot.booked_count }}/{{ slot.capacity }}</div>
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

      <!-- Main Slot Action Popup -->
      <div *ngIf="showSlotPopup" class="modal-overlay" (click)="showSlotPopup = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Manage Slot</h2>
          <div class="slot-popup-info" *ngIf="selectedSlot">
            <div class="popup-time">{{ formatDateTime(selectedSlot.start_time) }} - {{ formatTime(selectedSlot.end_time) }}</div>
            <div class="popup-trainer" *ngIf="selectedSlot?.trainer?.profile?.full_name">
              Trainer: <strong>{{ selectedSlot.trainer.profile.full_name }}</strong>
            </div>
            <div class="popup-capacity">Capacity: {{ selectedSlot.booked_count }} / {{ selectedSlot.capacity }}</div>
            <div class="popup-status">Status: <span class="status-badge" [class]="'status-' + selectedSlot.status">{{ selectedSlot.status }}</span></div>
          </div>
          
          <div class="popup-actions">
            <button class="popup-action-btn" (click)="toggleSlotEnableFromPopup()">
              <span *ngIf="selectedSlot?.status === 'disabled'">🟢 Enable Slot</span>
              <span *ngIf="selectedSlot?.status !== 'disabled'">⚪ Disable Slot</span>
            </button>
            <button class="popup-action-btn" (click)="editSlotFromPopup()" [disabled]="selectedSlot?.booked_count > 0">
              ✏️ Edit Slot
            </button>
            <button class="popup-action-btn" (click)="assignTrainerFromPopup()">
              👤 {{ selectedSlot?.trainer ? 'Change Trainer' : 'Assign Trainer' }}
            </button>
            <button class="popup-action-btn delete" (click)="deleteSlotFromPopup()" [disabled]="selectedSlot?.booked_count > 0">
              🗑️ Delete Slot
            </button>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="showSlotPopup = false">Close</button>
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
    .date-heading { margin: 8px 0 16px; }
    .date-heading h2 { margin: 0; font-size: 20px; color: #111827; }
    /* Removed view toggle; single list UI */
    .empty-state { padding: 60px; text-align: center; color: #6b7280; background: white; border-radius: 12px; }
    .slots-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:8px; }
    .slots-list { display: grid; gap: 10px; }
    .slot-card { background:#eafff0; padding:8px; border-radius:10px; border:2px solid #22c55e; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:88px; cursor:pointer; transition:all 0.2s; }
    .slot-card:hover { box-shadow:0 4px 12px rgba(0,0,0,.15); transform:translateY(-2px); }
    .slot-card.booked { background:#fee2e2; border-color:#dc2626; }
    .slot-card.booked:hover { box-shadow:0 4px 12px rgba(220,38,38,.25); }
    .slot-info { display:flex; flex-direction:column; align-items:center; gap:4px; width:100%; }
    .slot-time { font-weight:700; font-size:14px; margin-bottom: 0; color: #0f172a; }
    .slot-status-badge { display:inline-flex; align-items:center; gap:4px; }
    .slot-trainer-name { font-size: 10px; color: #6b7280; text-align:center; font-weight:500; }
    .slot-trainer-name.unassigned { color: #dc2626; font-weight:600; }
    .slot-capacity-small { font-size: 10px; color: #6b7280; margin-top:2px; }
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
    .slot-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .btn-edit, .btn-delete { padding: 6px 10px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 12px; }
    .btn-edit { background: #dbeafe; color: #1e40af; }
    .btn-edit:hover { background: #bfdbfe; }
    .btn-delete { background: #fee2e2; color: #991b1b; }
    .btn-delete:hover { background: #fecaca; }
    /* Calendar view removed */
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
    .slot-popup-info { margin-bottom: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .popup-time { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .popup-trainer, .popup-capacity, .popup-status { font-size: 14px; margin-bottom: 6px; }
    .popup-actions { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .popup-action-btn { padding: 12px 16px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; font-weight: 600; text-align: left; transition: all 0.2s; }
    .popup-action-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #3b82f6; }
    .popup-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .popup-action-btn.delete { border-color: #fee2e2; color: #991b1b; }
    .popup-action-btn.delete:hover:not(:disabled) { background: #fee2e2; }
  `]
})
export class AdminSlotsComponent implements OnInit, OnDestroy {
  slots: Slot[] = [];
  allSlots: Slot[] = [];
  filteredSlots: Slot[] = [];
  trainers: Trainer[] = [];
  onDutyTrainers: Trainer[] = [];
  showCreateModal = false;
  showAssignModal = false;
  showEditModal = false;
  showSlotPopup = false;
  selectedDate = '';
  availableDates: string[] = [];
  // Single list view only
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
    private trainerService: TrainerService,
    private toastService: ToastService
  ) {}

  getDefaultDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Normalize date string to YYYY-MM-DD format regardless of input format
  normalizeDate(dateStr: string | null | undefined): string {
    if (!dateStr) return this.getDefaultDate();
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse and convert to YYYY-MM-DD
    try {
      // Handle DD-MM-YYYY or MM/DD/YYYY formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateStr);
    }
    
    // Fallback to today
    return this.getDefaultDate();
  }

  async ngOnInit() {
    this.selectedDate = this.getDefaultDate();
    await this.loadDataForSelectedDate();
    this.subscribeToSlotEvents();
  }

  slotEventSource?: EventSource;

  subscribeToSlotEvents() {
    try {
      const apiUrl = environment.apiUrl || 'http://localhost:3000/api';
      const url = `${apiUrl}/events`;
      this.slotEventSource = new EventSource(url);
      this.slotEventSource.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          const evt = payload.event as string;
          if (!evt || !evt.startsWith('slot.')) return;
          
          // Reload only for the selected date
          await this.loadSlotsForSelectedDate();
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };
    } catch (e) {
      console.warn('SSE unavailable for admin panel');
    }
  }

  formatReadableDate(dateStr: string): string {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  ngOnDestroy() {
    if (this.slotEventSource) {
      this.slotEventSource.close();
    }
  }

  async loadDataForSelectedDate() {
    try {
      this.trainers = await this.trainerService.getAllTrainers();
      this.onDutyTrainers = await this.trainerService.getOnDutyTrainers();
      await this.loadSlotsForSelectedDate();
    } catch (error) {
      console.error('Failed to load data:', error);
      this.toastService.error('Failed to load data');
      this.filteredSlots = [];
    }
  }

  async loadSlotsForSelectedDate() {
    try {
      // Normalize the selected date to YYYY-MM-DD format
      this.selectedDate = this.normalizeDate(this.selectedDate);
      
      const slots = await this.slotService.getSlotsByDate(this.selectedDate);
      this.allSlots = slots || [];
      // Filter by both slot_date and start_time::date to handle mismatched dates
      // Normalize all dates to YYYY-MM-DD for comparison
      this.slots = this.allSlots.filter(s => {
        const slotDate = s.slot_date || (s.start_time ? new Date(s.start_time).toISOString().split('T')[0] : null);
        const startDate = s.start_time ? new Date(s.start_time).toISOString().split('T')[0] : null;
        const normalizedSlotDate = this.normalizeDate(slotDate);
        const normalizedStartDate = this.normalizeDate(startDate);
        return normalizedSlotDate === this.selectedDate || normalizedStartDate === this.selectedDate;
      });
      this.filterSlots();
    } catch (error) {
      console.error('Failed to load slots:', error);
      this.toastService.error('Failed to load slots');
      this.filteredSlots = [];
    }
  }

  async onSelectedDateChange() {
    // Normalize the date when it changes
    this.selectedDate = this.normalizeDate(this.selectedDate);
    await this.loadSlotsForSelectedDate();
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
  }

  // Pagination removed; showing all slots for the selected date

  // Available dates list removed with calendar-driven daily view

  async generateSlotsForSelectedDate() {
    if (!this.selectedDate) return;
    try {
      // Normalize date to YYYY-MM-DD format before sending to API
      const normalizedDate = this.normalizeDate(this.selectedDate);
      const res = await this.slotService.generateDailySlots(normalizedDate);
      if (res && res.success === false) {
        this.toastService.warning(res.message || 'Slots already exist for this date.');
      } else {
        this.toastService.success('Slots generated successfully');
      }
      // Update selectedDate to normalized format
      this.selectedDate = normalizedDate;
      await this.loadSlotsForSelectedDate();
    } catch (error: any) {
      console.error('Generate slots error:', error);
      this.toastService.error(error?.error?.message || error?.message || 'Failed to generate slots');
    }
  }

  async createSlot() {
    try {
      const startTime = new Date(this.newSlot.start_time);
      const slotDate = startTime.toISOString().split('T')[0]; // Extract date from start_time
      
      await this.slotService.createSlot({
        trainer_id: this.newSlot.trainer_id || null,
        start_time: startTime.toISOString(),
        end_time: new Date(this.newSlot.end_time).toISOString(),
        capacity: this.newSlot.capacity,
        status: 'available',
        slot_date: slotDate,
        is_auto_generated: false
      } as any);
      this.showCreateModal = false;
      this.newSlot = { trainer_id: '', start_time: '', end_time: '', capacity: 1 };
      await this.loadSlotsForSelectedDate();
      this.toastService.success('Slot created successfully');
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to create slot');
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
      const startTime = new Date(this.editingSlot.start_time);
      const slotDate = startTime.toISOString().split('T')[0]; // Extract date from start_time
      
      await this.slotService.updateSlot(this.editingSlot.id, {
        start_time: startTime.toISOString(),
        end_time: new Date(this.editingSlot.end_time).toISOString(),
        capacity: this.editingSlot.capacity,
        status: this.editingSlot.status,
        slot_date: slotDate
      });
      this.showEditModal = false;
      await this.loadSlotsForSelectedDate();
      this.toastService.success('Slot updated successfully');
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to update slot');
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
      // Refresh data to get latest from backend
      await this.loadSlotsForSelectedDate();
      const wasAssigned = !!this.selectedTrainerId;
      this.showAssignModal = false;
      this.selectedTrainerId = '';
      this.selectedSlot = null;
      this.toastService.success(wasAssigned ? 'Trainer assigned successfully' : 'Trainer unassigned successfully');
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to assign trainer');
      await this.loadSlotsForSelectedDate();
    }
  }

  async unassignTrainer(slotId: string) {
    if (!confirm('Unassign trainer from this slot?')) return;
    try {
      await this.slotService.unassignTrainer(slotId);
      // Refresh data to get latest from backend
      await this.loadSlotsForSelectedDate();
      this.toastService.success('Trainer unassigned successfully');
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to unassign trainer');
      await this.loadSlotsForSelectedDate();
    }
  }

  async deleteSlot(id: string) {
    if (!confirm('Delete this slot?')) return;
    try {
      await this.slotService.deleteSlot(id);
      await this.loadSlotsForSelectedDate();
      this.toastService.success('Slot deleted successfully');
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to delete slot');
    }
  }

  async toggleSlotStatus(slot: Slot) {
    try {
      const newStatus = slot.status === 'available' ? 'cancelled' : 'available';
      await this.slotService.updateSlotStatus(slot.id, newStatus);
      // Refresh data to get latest from backend
      await this.loadSlotsForSelectedDate();
      this.toastService.success(`Slot status updated to ${newStatus}`);
    } catch (error: any) {
      this.toastService.error(error?.error?.error || error?.error?.message || 'Failed to update slot status');
      await this.loadSlotsForSelectedDate();
    }
  }

  async toggleSlotEnable(slot: Slot) {
    try {
      const isCurrentlyDisabled = slot.status === 'disabled';
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
      
      // Refresh data to get latest from backend
      await this.loadSlotsForSelectedDate();
      this.toastService.success(`Slot ${isCurrentlyDisabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error: any) {
      this.toastService.error(error.message || error?.error?.error || error?.error?.message || 'Failed to toggle slot');
      await this.loadSlotsForSelectedDate();
    }
  }

  // Calendar helpers removed

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

  openSlotPopup(slot: Slot) {
    this.selectedSlot = slot;
    this.showSlotPopup = true;
  }

  toggleSlotEnableFromPopup() {
    if (this.selectedSlot) {
      this.toggleSlotEnable(this.selectedSlot);
      this.showSlotPopup = false;
    }
  }

  editSlotFromPopup() {
    if (this.selectedSlot) {
      this.editSlot(this.selectedSlot);
      this.showSlotPopup = false;
    }
  }

  assignTrainerFromPopup() {
    if (this.selectedSlot) {
      this.openAssignTrainer(this.selectedSlot);
      this.showSlotPopup = false;
    }
  }

  async deleteSlotFromPopup() {
    if (this.selectedSlot) {
      this.showSlotPopup = false;
      await this.deleteSlot(this.selectedSlot.id);
    }
  }
}
