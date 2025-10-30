import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { BookingService } from '../../../services/booking.service';

@Component({
  selector: 'app-admin-slots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="slots-page">
      <div class="page-header">
        <h1 class="page-title">Manage Slots</h1>
        <button class="btn-primary" (click)="showCreateModal = true">+ Create Slot</button>
      </div>

      <div class="slots-list" *ngIf="slots.length > 0">
        <div *ngFor="let slot of slots" class="slot-card">
          <div class="slot-info">
            <div class="slot-time">{{ formatDateTime(slot.start_time) }} - {{ formatTime(slot.end_time) }}</div>
            <div class="slot-trainer">Trainer: {{ slot.trainer?.profile?.full_name }}</div>
            <div class="slot-capacity">Capacity: {{ slot.booked_count }} / {{ slot.capacity }}</div>
            <span class="status-badge" [class]="'status-' + slot.status">{{ slot.status }}</span>
          </div>
          <div class="slot-actions">
            <button class="btn-edit" (click)="editSlot(slot)">Edit</button>
            <button class="btn-delete" (click)="deleteSlot(slot.id)">Delete</button>
          </div>
        </div>
      </div>

      <div *ngIf="showCreateModal" class="modal-overlay" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Create New Slot</h2>
          <form (ngSubmit)="createSlot()">
            <div class="form-group">
              <label>Trainer</label>
              <select [(ngModel)]="newSlot.trainer_id" name="trainer" required>
                <option value="">Select Trainer</option>
                <option *ngFor="let trainer of trainers" [value]="trainer.id">
                  {{ trainer.profile?.full_name }}
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
    </div>
  `,
  styles: [`
    .slots-page { max-width: 1200px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 32px; font-weight: 700; color: #1f2937; margin: 0; }
    .btn-primary { padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .slots-list { display: grid; gap: 16px; }
    .slot-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .slot-time { font-weight: 600; font-size: 16px; margin-bottom: 8px; }
    .slot-trainer, .slot-capacity { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-available { background: #d1fae5; color: #065f46; }
    .status-full { background: #fee2e2; color: #991b1b; }
    .slot-actions { display: flex; gap: 8px; }
    .btn-edit, .btn-delete { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
    .btn-edit { background: #dbeafe; color: #1e40af; }
    .btn-delete { background: #fee2e2; color: #991b1b; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 32px; border-radius: 16px; width: 90%; max-width: 500px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #374151; }
    .form-group input, .form-group select { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .modal-actions { display: flex; gap: 12px; margin-top: 24px; }
    .btn-secondary { padding: 12px 24px; background: white; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
  `]
})
export class AdminSlotsComponent implements OnInit {
  slots: any[] = [];
  trainers: any[] = [];
  showCreateModal = false;
  newSlot = { trainer_id: '', start_time: '', end_time: '', capacity: 1 };

  constructor(
    private adminService: AdminService,
    private bookingService: BookingService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.slots = await this.bookingService.loadSlots();
    this.trainers = await this.bookingService.getActiveTrainers();
  }

  async createSlot() {
    try {
      await this.adminService.createSlot({
        trainer_id: this.newSlot.trainer_id,
        start_time: new Date(this.newSlot.start_time).toISOString(),
        end_time: new Date(this.newSlot.end_time).toISOString(),
        capacity: this.newSlot.capacity
      });
      this.showCreateModal = false;
      await this.loadData();
    } catch (error) {
      alert('Failed to create slot');
    }
  }

  editSlot(slot: any) {
    alert('Edit functionality coming soon');
  }

  async deleteSlot(id: string) {
    if (!confirm('Delete this slot?')) return;
    try {
      await this.adminService.deleteSlot(id);
      await this.loadData();
    } catch (error) {
      alert('Failed to delete slot');
    }
  }

  formatDateTime(date: string) {
    return new Date(date).toLocaleString();
  }

  formatTime(date: string) {
    return new Date(date).toLocaleTimeString();
  }
}
