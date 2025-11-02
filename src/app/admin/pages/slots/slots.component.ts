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
          <select [(ngModel)]="selectedDate" (change)="loadSlotsByDate()" class="date-filter">
            <option value="">All Dates</option>
            <option *ngFor="let date of availableDates" [value]="date">{{ date }}</option>
          </select>
          <button class="btn-primary" (click)="generateSlots()">🔄 Generate Daily Slots</button>
          <button class="btn-primary" (click)="showCreateModal = true">+ Create Slot</button>
        </div>
      </div>

      <div class="view-toggle">
        <button [class.active]="viewMode === 'list'" (click)="viewMode = 'list'">📋 List View</button>
        <button [class.active]="viewMode === 'calendar'" (click)="viewMode = 'calendar'">📅 Calendar View</button>
      </div>

      <div *ngIf="viewMode === 'list'" class="slots-list">
        <div *ngIf="slots.length === 0" class="empty-state">No slots found. Generate daily slots to get started.</div>
        <div *ngFor="let slot of slots" class="slot-card">
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
            <span class="status-badge" [class]="'status-' + slot.status">{{ slot.status }}</span>
            <span class="auto-tag" *ngIf="slot.is_auto_generated">Auto-generated</span>
          </div>
          <div class="slot-actions">
            <button class="btn-edit" (click)="editSlot(slot)">✏️ Edit</button>
            <button class="btn-delete" (click)="deleteSlot(slot.id)">🗑️ Delete</button>
          </div>
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
              <div *ngFor="let slot of day.slots" class="calendar-slot" [class.assigned]="slot.trainer_id">
                <div class="slot-time-compact">{{ formatTimeOnly(slot.start_time) }}</div>
                <div class="slot-trainer-compact" *ngIf="slot.trainer">
                  {{ slot.trainer.profile?.full_name }}
                </div>
                <div class="slot-trainer-compact unassigned" *ngIf="!slot.trainer">Unassigned</div>
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
              <option value="">Select a trainer</option>
              <option *ngFor="let trainer of onDutyTrainers" [value]="trainer.id">
                {{ trainer.profile?.full_name }}
              </option>
            </select>
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
    .slot-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; transition: box-shadow 0.2s; }
    .slot-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .slot-time { font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1f2937; }
    .slot-trainer, .slot-capacity { font-size: 14px; color: #6b7280; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .unassigned { color: #dc2626; font-weight: 600; }
    .btn-link { background: none; border: none; color: #3b82f6; cursor: pointer; text-decoration: underline; font-size: 13px; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-right: 8px; }
    .status-available { background: #d1fae5; color: #065f46; }
    .status-full { background: #fee2e2; color: #991b1b; }
    .status-cancelled { background: #fef3c7; color: #92400e; }
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
    .calendar-slot { padding: 8px; margin-bottom: 8px; border-radius: 6px; background: #f9fafb; border-left: 3px solid #e5e7eb; }
    .calendar-slot.assigned { border-left-color: #10b981; background: #d1fae5; }
    .slot-time-compact { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
    .slot-trainer-compact { font-size: 11px; color: #6b7280; }
    .slot-trainer-compact.unassigned { color: #dc2626; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 32px; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
    .btn-secondary { padding: 12px 24px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
  `]
})
export class AdminSlotsComponent implements OnInit {
  slots: Slot[] = [];
  allSlots: Slot[] = [];
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

  constructor(
    private slotService: SlotService,
    private trainerService: TrainerService
  ) {}

  async ngOnInit() {
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
    }
  }

  async loadSlots() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      const end = endDate.toISOString().split('T')[0];
      this.allSlots = await this.slotService.getSlotsByDateRange(today, end);
      this.slots = this.allSlots;
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
    if (this.viewMode === 'calendar') {
      this.updateCalendar();
    }
  }

  updateAvailableDates() {
    const dates = new Set<string>();
    this.allSlots.forEach(slot => dates.add(slot.slot_date));
    this.availableDates = Array.from(dates).sort();
  }

  async generateSlots() {
    try {
      const result = await this.slotService.generateDailySlots();
      alert(result.message || 'Slots generated successfully');
      await this.loadData();
    } catch (error) {
      alert('Failed to generate slots');
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
    if (!this.selectedTrainerId || !this.selectedSlot) return;
    try {
      await this.slotService.assignTrainer(this.selectedSlot.id, this.selectedTrainerId);
      this.showAssignModal = false;
      this.selectedTrainerId = '';
      this.selectedSlot = null;
      await this.loadData();
    } catch (error) {
      alert('Failed to assign trainer');
    }
  }

  async unassignTrainer(slotId: string) {
    if (!confirm('Unassign trainer from this slot?')) return;
    try {
      await this.slotService.unassignTrainer(slotId);
      await this.loadData();
    } catch (error) {
      alert('Failed to unassign trainer');
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
