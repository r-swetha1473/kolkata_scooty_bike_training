import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../../services/slot.service';
import { TrainerService, Trainer } from '../../../services/trainer.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { environment } from '../../../../environments/environment';
import { normalizeDate, addDays, getToday, isSameDay, formatTimeToAMPM, timeToMinutes, extractTime, extractDateFromDateTime } from '../../../utils/date.utils';
import { getAuthToken } from '../../../utils/auth-token.storage';

@Component({
  selector: 'app-admin-slots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="slots-page">
      <div class="admin-page-header">
        <h1 class="admin-page-title">Manage Slots</h1>
        <div class="admin-page-actions">
          <button class="admin-btn admin-btn-secondary" (click)="generateSlotsForSelectedDate()">Generate Slots</button>
          <button class="admin-btn admin-btn-primary" (click)="showCreateModal = true">Create Slot</button>
        </div>
      </div>

      <div class="admin-filters-bar">
        <div class="admin-filters-content">
          <div class="date-navigation-compact">
            <button class="date-nav-btn" (click)="navigateDate(-1)" title="Previous day">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div class="date-picker-wrapper">
              <input 
                type="date" 
                [(ngModel)]="selectedDate" 
                (change)="onSelectedDateChange()"
                class="date-picker-input">
              <span class="date-display-text">{{ formatReadableDate(selectedDate) }}</span>
            </div>
            <button class="date-nav-btn" (click)="navigateDate(1)" title="Next day">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <button class="date-today-btn" (click)="goToToday()">Today</button>
          </div>

          <div class="admin-filter-group admin-search-group">
            <svg class="admin-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input 
              type="text" 
              [(ngModel)]="searchTerm" 
              (input)="filterSlots()"
              placeholder="Search trainer or time..." 
              class="admin-search-input">
          </div>

          <select [(ngModel)]="statusFilter" (change)="filterSlots()" class="admin-select">
            <option value="">All Status</option>
            <option value="available">Active</option>
            <option value="disabled">Disabled</option>
            <option value="full">Full</option>
          </select>
        </div>
      </div>

      <div class="slots-list-container">

        <div *ngIf="filteredSlots.length === 0" class="empty-state">
          <p>No slots for {{ formatReadableDate(selectedDate) }}</p>
          <button class="admin-btn admin-btn-primary" (click)="generateSlotsForSelectedDate()">Generate Slots</button>
        </div>
        <div class="slots-grid-compact" *ngIf="filteredSlots.length > 0">
          <div *ngFor="let slot of filteredSlots" class="slot-card-compact" [class.status-disabled]="slot.status === 'disabled'">
            <div class="slot-card-header">
              <div class="slot-time-compact">
                <span class="time-start">{{ formatTimeOnly(slot.start_time) }}</span>
                <span class="time-separator">–</span>
                <span class="time-end">{{ formatTimeOnly(slot.end_time) }}</span>
              </div>
              <div class="slot-status-indicator" [class]="'indicator-' + slot.status"></div>
            </div>
            
            <div class="slot-card-body">
              <div class="slot-trainer-chip" *ngIf="slot.trainer?.profile?.full_name; else unassignedChip">
                <svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
                <span>{{ slot.trainer.profile.full_name }}</span>
              </div>
              <ng-template #unassignedChip>
                <div class="slot-trainer-chip unassigned-chip">
                  <svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  <span>Unassigned</span>
                </div>
              </ng-template>

              <div class="slot-capacity-compact">
                <div class="vehicle-capacity-grid" *ngIf="vehicleRows(slot).length > 0; else legacyVehicleCap">
                  <div *ngFor="let vc of vehicleRows(slot)" class="vehicle-capacity-item"
                    [class.full]="vc.booked >= vc.capacity"
                    [class.warning]="vc.capacity > 0 && vc.booked >= vc.capacity * 0.8 && vc.booked < vc.capacity">
                    <span class="vehicle-label">{{ vc.vehicle_name }}</span>
                    <span class="vehicle-count">{{ vc.booked }} / {{ vc.capacity }}</span>
                  </div>
                </div>
                <ng-template #legacyVehicleCap>
                  <div class="vehicle-capacity-grid">
                    <div class="vehicle-capacity-item">
                      <span class="vehicle-label">⚡ Electric</span>
                      <span class="vehicle-count">{{ slot.electric_booked || 0 }} / {{ slot.electric_capacity || 3 }}</span>
                    </div>
                    <div class="vehicle-capacity-item">
                      <span class="vehicle-label">⛽ Petrol</span>
                      <span class="vehicle-count">{{ slot.petrol_booked || 0 }} / {{ slot.petrol_capacity || 1 }}</span>
                    </div>
                    <div class="vehicle-capacity-item">
                      <span class="vehicle-label">🏍️ Bike</span>
                      <span class="vehicle-count">{{ slot.bike_booked || 0 }} / {{ slot.bike_capacity || 1 }}</span>
                    </div>
                  </div>
                </ng-template>
                <!-- Legacy total capacity (keep for reference) -->
                <div class="capacity-header" style="margin-top: 8px;">
                  <span class="capacity-text" style="font-size: 11px; color: var(--admin-text-secondary);">Total: {{ slot.booked_count }} / {{ slot.capacity }}</span>
                </div>
              </div>
            </div>

            <div class="slot-card-actions">
              <button class="slot-action-btn" (click)="editSlotFromMenu(slot)" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="slot-action-btn" (click)="toggleSlotEnableFromMenu(slot)" [title]="slot.status === 'disabled' ? 'Enable' : 'Disable'">
                <svg *ngIf="slot.status === 'disabled'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <svg *ngIf="slot.status !== 'disabled'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
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
            <div class="popup-time">{{ formatDateTime(selectedSlot.start_time, selectedSlot.slot_date) }} - {{ formatTime(selectedSlot.end_time) }}</div>
            <div class="popup-trainer" *ngIf="selectedSlot?.trainer?.profile?.full_name">
              Trainer: <strong>{{ selectedSlot.trainer.profile.full_name }}</strong>
            </div>
            
            <div class="popup-vehicle-capacity" *ngIf="vehicleRows(selectedSlot).length > 0; else legacyPopupVc">
              <div class="vehicle-capacity-row" *ngFor="let vc of vehicleRows(selectedSlot)">
                <span class="vehicle-label-popup">{{ vc.vehicle_name }}:</span>
                <span class="vehicle-count-popup">{{ vc.booked }} / {{ vc.capacity }}</span>
                <button type="button" class="vehicle-control-btn" (click)="openVehicleCapacityModal(vc)" title="Adjust capacity">⚙️</button>
              </div>
            </div>
            <ng-template #legacyPopupVc>
              <div class="popup-vehicle-capacity">
                <div class="vehicle-capacity-row">
                  <span class="vehicle-label-popup">⚡ Electric:</span>
                  <span class="vehicle-count-popup">{{ selectedSlot.electric_booked || 0 }} / {{ selectedSlot.electric_capacity || 3 }}</span>
                  <button type="button" class="vehicle-control-btn" (click)="openVehicleCapacityModalLegacy('ELECTRIC')">⚙️</button>
                </div>
                <div class="vehicle-capacity-row">
                  <span class="vehicle-label-popup">⛽ Petrol:</span>
                  <span class="vehicle-count-popup">{{ selectedSlot.petrol_booked || 0 }} / {{ selectedSlot.petrol_capacity || 1 }}</span>
                  <button type="button" class="vehicle-control-btn" (click)="openVehicleCapacityModalLegacy('PETROL')">⚙️</button>
                </div>
                <div class="vehicle-capacity-row">
                  <span class="vehicle-label-popup">🏍️ Bike:</span>
                  <span class="vehicle-count-popup">{{ selectedSlot.bike_booked || 0 }} / {{ selectedSlot.bike_capacity || 1 }}</span>
                  <button type="button" class="vehicle-control-btn" (click)="openVehicleCapacityModalLegacy('BIKE')">⚙️</button>
                </div>
              </div>
            </ng-template>
            
            <div class="popup-capacity">Total: {{ selectedSlot.booked_count }} / {{ selectedSlot.capacity }}</div>
            <div class="popup-status">Status: <span class="status-badge" [class]="'status-' + selectedSlot.status">{{ selectedSlot.status }}</span></div>
          </div>
          
          <div class="popup-actions">
            <button class="popup-action-btn" (click)="toggleSlotEnableFromPopup()">
              <span *ngIf="selectedSlot?.status === 'disabled'">Enable Slot</span>
              <span *ngIf="selectedSlot?.status !== 'disabled'">Disable Slot</span>
            </button>
            <button class="popup-action-btn" (click)="editSlotFromPopup()" [disabled]="selectedSlot?.booked_count > 0">
              Edit Slot
            </button>
            <button class="popup-action-btn" (click)="assignTrainerFromPopup()">
              {{ selectedSlot?.trainer ? 'Change Trainer' : 'Assign Trainer' }}
            </button>
            <button class="popup-action-btn delete" (click)="deleteSlotFromPopup()" [disabled]="selectedSlot?.booked_count > 0">
              Delete Slot
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

      <!-- Generate Slots Confirmation Modal -->
      <div *ngIf="showGenerateConfirmModal" class="modal-overlay" (click)="cancelGenerateConfirm()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Slots Already Exist</h2>
          <div class="confirm-message">
            <p>Slots already exist for <strong>{{ formatReadableDate(selectedDate) }}</strong>.</p>
            <p>Would you like to generate slots for the next available date?</p>
            <p class="next-date-info">
              <strong>Next available date:</strong> {{ formatReadableDate(nextAvailableDate) }}
            </p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="cancelGenerateConfirm()">Cancel</button>
            <button type="button" class="btn-primary" (click)="confirmGenerateForNextDate()">Generate for Next Day</button>
          </div>
        </div>
      </div>

      <div *ngIf="showVehicleCapacityModal" class="modal-overlay" (click)="closeVehicleCapacityModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Adjust {{ selectedVehicleRow?.vehicle_name || 'vehicle' }} capacity</h2>
          <div class="confirm-message" *ngIf="selectedVehicleRow">
            <p><strong>Current:</strong> {{ selectedVehicleRow.booked }} / {{ selectedVehicleRow.capacity }} booked</p>
            <p class="warning-text" *ngIf="selectedVehicleRow.booked > 0">
              Cannot reduce capacity below {{ selectedVehicleRow.booked }} (current bookings)
            </p>
          </div>
          <div class="form-group">
            <label>New Capacity</label>
            <input 
              type="number" 
              [(ngModel)]="newVehicleCapacity" 
              [min]="selectedVehicleRow?.booked || 0"
              [max]="10"
              required>
            <p class="form-help">Minimum: {{ selectedVehicleRow?.booked || 0 }} (current bookings)</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeVehicleCapacityModal()">Cancel</button>
            <button type="button" class="btn-primary" (click)="updateVehicleCapacity()" [disabled]="!newVehicleCapacity || !selectedVehicleRow || newVehicleCapacity < selectedVehicleRow.booked">Update</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .slots-page { max-width: 1400px; }

    .admin-search-group {
      flex: 0 1 280px;
      max-width: 100%;
    }

    .admin-search-input {
      max-width: 280px;
      width: 100%;
    }

    .admin-select {
      min-width: 140px;
      max-width: 200px;
    }

    /* Date Navigation - Compact */
    .date-navigation-compact {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 12px;
      border-right: 1px solid var(--admin-border);
    }

    .date-nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: var(--admin-bg);
      border: 1px solid var(--admin-border);
      border-radius: 50%;
      cursor: pointer;
      color: var(--admin-text-secondary);
      transition: var(--admin-transition);
      box-shadow: var(--admin-shadow-sm);
    }

    .date-nav-btn:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
      color: var(--admin-primary);
      box-shadow: var(--admin-shadow-md);
      transform: translateY(-1px);
    }

    .date-nav-btn:active {
      transform: translateY(0);
      box-shadow: var(--admin-shadow-sm);
    }

    .date-picker-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 28%;
      max-width: 220px;
      min-width: 150px;
      height: 36px;
      padding: 0 10px;
      background: var(--admin-bg);
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius);
      cursor: pointer;
      transition: var(--admin-transition);
      box-shadow: var(--admin-shadow-sm);
    }

    .date-picker-wrapper:hover {
      border-color: var(--admin-primary);
      box-shadow: var(--admin-shadow-md);
    }

    .date-picker-input {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      font-size: 0;
    }

    .date-display-text {
      font-size: 13px;
      font-weight: 500;
      color: var(--admin-text);
      pointer-events: none;
    }

    .date-today-btn {
      padding: 0 10px;
      height: 32px;
      font-size: 12px;
      font-weight: 500;
      background: var(--admin-bg);
      color: var(--admin-text-secondary);
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius-sm);
      cursor: pointer;
      transition: var(--admin-transition);
      white-space: nowrap;
      box-shadow: var(--admin-shadow-sm);
    }

    .date-today-btn:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
      color: var(--admin-primary);
      box-shadow: var(--admin-shadow-md);
      transform: translateY(-1px);
    }

    .date-today-btn:active {
      transform: translateY(0);
      box-shadow: var(--admin-shadow-sm);
    }


    /* Empty State */
    .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: var(--admin-text-secondary);
      background: var(--admin-bg);
      border-radius: var(--admin-radius);
      border: 1px dashed var(--admin-border);
      box-shadow: var(--admin-shadow-sm);
    }

    .empty-state p {
      margin: 0 0 16px 0;
      font-size: 14px;
    }

    /* Compact Slots Grid */
    .slots-grid-compact {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }

    /* Compact Slot Card */
    .slot-card-compact {
      background: var(--admin-bg);
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius);
      padding: 12px;
      transition: var(--admin-transition);
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: var(--admin-shadow-sm);
    }

    .slot-card-compact:hover {
      box-shadow: var(--admin-shadow-md);
      border-color: var(--admin-primary);
      transform: translateY(-2px);
    }

    .slot-card-compact.status-disabled {
      background: var(--admin-bg-hover);
      opacity: 0.7;
    }

    /* Slot Card Header */
    .slot-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      border-bottom: 1px solid #F3F4F6;
    }

    .slot-time-compact {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      font-size: 14px;
      color: var(--admin-text);
    }

    .time-start, .time-end {
      font-weight: 600;
    }

    .time-separator {
      color: var(--admin-text-secondary);
      font-weight: 400;
    }

    .slot-status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .slot-status-indicator.indicator-available {
      background: var(--admin-success);
    }

    .slot-status-indicator.indicator-disabled {
      background: var(--admin-text-secondary);
    }

    .slot-status-indicator.indicator-full {
      background: var(--admin-danger);
    }

    .slot-status-indicator.indicator-cancelled {
      background: var(--admin-text-secondary);
    }

    .slot-status-indicator.indicator-completed {
      background: var(--admin-primary);
    }

    /* Slot Card Body */
    .slot-card-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Trainer Chip */
    .slot-trainer-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #E0E7FF;
      color: #4338CA;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      width: fit-content;
    }

    .slot-trainer-chip.unassigned-chip {
      background: #FEE2E2;
      color: #991B1B;
    }

    .chip-icon {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }

    /* Capacity Compact */
    .slot-capacity-compact {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .capacity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .capacity-text {
      font-size: 12px;
      font-weight: 600;
      color: var(--admin-text);
    }

    .capacity-progress-bar {
      height: 6px;
      background: #F3F4F6;
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--admin-success);
      transition: width 0.3s ease;
      border-radius: 3px;
    }

    .progress-fill.full {
      background: var(--admin-danger);
    }

    /* PHASE 4: Vehicle Capacity Grid */
    .vehicle-capacity-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 4px;
    }

    .vehicle-capacity-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 4px;
      background: #F3F4F6;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: var(--admin-transition);
    }

    .vehicle-capacity-item.warning {
      background: #FEF3C7;
      border-color: #F59E0B;
    }

    .vehicle-capacity-item.full {
      background: #FEE2E2;
      border-color: #EF4444;
    }

    .vehicle-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--admin-text-secondary);
      margin-bottom: 2px;
      text-align: center;
    }

    .vehicle-capacity-item.full .vehicle-label {
      color: #991B1B;
    }

    .vehicle-capacity-item.warning .vehicle-label {
      color: #92400E;
    }

    .vehicle-count {
      font-size: 11px;
      font-weight: 700;
      color: var(--admin-text);
    }

    .vehicle-capacity-item.full .vehicle-count {
      color: #991B1B;
    }

    .vehicle-capacity-item.warning .vehicle-count {
      color: #92400E;
    }

    /* Slot Card Actions */
    .slot-card-actions {
      display: flex;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px solid #F3F4F6;
    }

    .slot-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--admin-border);
      border-radius: var(--admin-radius-sm);
      cursor: pointer;
      color: var(--admin-text-secondary);
      transition: var(--admin-transition);
      box-shadow: var(--admin-shadow-sm);
    }

    .slot-action-btn:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
      color: var(--admin-primary);
      box-shadow: var(--admin-shadow-md);
      transform: translateY(-1px);
    }

    .slot-action-btn:active {
      transform: translateY(0);
      box-shadow: var(--admin-shadow-sm);
    }

    /* Modal Styles */
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
      border-radius: 16px; 
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
      color: #374151; 
    }

    .form-group input, .form-group select { 
      width: 100%; 
      padding: 12px; 
      border: 2px solid #e5e7eb; 
      border-radius: 8px; 
      font-size: 14px; 
    }

    .form-help { 
      margin-top: 8px; 
      font-size: 12px; 
      color: #6b7280; 
    }

    .modal-actions { 
      display: flex; 
      gap: 12px; 
      margin-top: 24px; 
    }

    .btn-secondary { 
      padding: 12px 24px; 
      background: white; 
      border: 2px solid #e5e7eb; 
      border-radius: 8px; 
      cursor: pointer; 
    }

    .slots-list-container {
      display: flex;
      flex-direction: column;
    }

    .slot-popup-info { 
      margin-bottom: 20px; 
      padding: 16px; 
      background: #f9fafb; 
      border-radius: 8px; 
    }

    .popup-time { 
      font-size: 18px; 
      font-weight: 700; 
      margin-bottom: 8px; 
    }

    .popup-trainer, .popup-capacity, .popup-status { 
      font-size: 14px; 
      margin-bottom: 6px; 
    }

    .popup-vehicle-capacity {
      margin: 16px 0;
      padding: 12px;
      background: #F9FAFB;
      border-radius: 8px;
      border: 1px solid var(--admin-border);
    }

    .vehicle-capacity-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }

    .vehicle-capacity-row:last-child {
      border-bottom: none;
    }

    .vehicle-label-popup {
      font-size: 14px;
      font-weight: 600;
      color: var(--admin-text);
      flex: 1;
    }

    .vehicle-count-popup {
      font-size: 14px;
      font-weight: 700;
      color: var(--admin-text);
      margin-right: 8px;
    }

    .vehicle-control-btn {
      padding: 4px 8px;
      background: white;
      border: 1px solid var(--admin-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: var(--admin-transition);
    }

    .vehicle-control-btn:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
    }

    .warning-text {
      color: #92400E;
      font-size: 13px;
      margin-top: 8px;
      padding: 8px;
      background: #FEF3C7;
      border-radius: 4px;
    }

    .popup-actions { 
      display: flex; 
      flex-direction: column; 
      gap: 10px; 
      margin-bottom: 20px; 
    }

    .popup-action-btn { 
      padding: 12px 16px; 
      background: white; 
      border: 2px solid #e5e7eb; 
      border-radius: 8px; 
      cursor: pointer; 
      font-weight: 600; 
      text-align: left; 
      transition: all 0.2s; 
    }

    .popup-action-btn:hover:not(:disabled) { 
      background: #f3f4f6; 
      border-color: #3b82f6; 
    }

    .popup-action-btn:disabled { 
      opacity: 0.5; 
      cursor: not-allowed; 
    }

    .popup-action-btn.delete { 
      border-color: #fee2e2; 
      color: #991b1b; 
    }

    .popup-action-btn.delete:hover:not(:disabled) {
      background: #fee2e2;
    }

    .confirm-message {
      margin-bottom: 24px;
      padding: 20px;
      background: var(--admin-bg-subtle);
      border-radius: var(--admin-radius);
      border: 1px solid var(--admin-border);
    }

    .confirm-message p {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: var(--admin-text);
      line-height: 1.6;
    }

    .confirm-message p:last-child {
      margin-bottom: 0;
    }

    .confirm-message strong {
      color: var(--admin-text);
      font-weight: 600;
    }

    .next-date-info {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--admin-border);
      font-size: 15px;
    }

    .next-date-info strong {
      color: var(--admin-primary);
      font-weight: 600;
    }

    /* PHASE 4: Vehicle Capacity Popup Styles */
    .popup-vehicle-capacity {
      margin: 16px 0;
      padding: 12px;
      background: #F9FAFB;
      border-radius: 8px;
      border: 1px solid var(--admin-border);
    }

    .vehicle-capacity-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }

    .vehicle-capacity-row:last-child {
      border-bottom: none;
    }

    .vehicle-label-popup {
      font-size: 14px;
      font-weight: 600;
      color: var(--admin-text);
      flex: 1;
    }

    .vehicle-count-popup {
      font-size: 14px;
      font-weight: 700;
      color: var(--admin-text);
      margin-right: 8px;
    }

    .vehicle-control-btn {
      padding: 4px 8px;
      background: white;
      border: 1px solid var(--admin-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: var(--admin-transition);
    }

    .vehicle-control-btn:hover {
      background: var(--admin-bg-hover);
      border-color: var(--admin-primary);
    }

    .warning-text {
      color: #92400E;
      font-size: 13px;
      margin-top: 8px;
      padding: 8px;
      background: #FEF3C7;
      border-radius: 4px;
    }

    @media (max-width: 768px) {
      .slots-grid-compact {
        grid-template-columns: 1fr;
      }

      .date-navigation-compact {
        border-right: none;
        border-bottom: 1px solid var(--admin-border);
        padding-bottom: 12px;
        padding-right: 0;
        margin-bottom: 12px;
      }
    }
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
  showGenerateConfirmModal = false;
  selectedDate = '';
  availableDates: string[] = [];
  // Single list view only
  selectedTrainerId = '';
  selectedSlot: any = null;
  newSlot = { trainer_id: '', start_time: '', end_time: '', capacity: 1 };
  editingSlot: any = { id: '', start_time: '', end_time: '', capacity: 1, status: 'available' };
  
  showVehicleCapacityModal = false;
  selectedVehicleRow: { vehicle_id: string; vehicle_name: string; capacity: number; booked: number } | null = null;
  newVehicleCapacity: number = 0;
  
  // Search (no pagination for slots - display all slots for selected date)
  searchTerm = '';
  statusFilter = '';
  slotGenerationDate = '';
  activeMenuSlot: string | null = null;
  nextAvailableDate: string = '';
  pendingGenerationDate: string = '';

  constructor(
    private slotService: SlotService,
    private trainerService: TrainerService,
    private toastService: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  /**
   * PHASE 3: Get today's date using centralized utility
   */
  getDefaultDate(): string {
    return getToday();
  }

  /**
   * PHASE 3: Normalize a date to UTC midnight and return as YYYY-MM-DD string
   * Wrapper around centralized utility for backward compatibility
   */
  normalizeToUTCDate(date: Date | string): string {
    const normalized = normalizeDate(date);
    return normalized || getToday();
  }

  /**
   * PHASE 3: Normalize date string to YYYY-MM-DD format using centralized utility
   * Wrapper around centralized utility for backward compatibility
   */
  normalizeDate(dateStr: string | null | undefined): string {
    if (!dateStr) return getToday();
    const normalized = normalizeDate(dateStr);
    return normalized || getToday();
  }

  async ngOnInit() {
    this.selectedDate = this.getDefaultDate();
    await this.loadDataForSelectedDate();
    this.subscribeToSlotEvents();
    
    // Close menu when clicking outside (with slight delay to allow menu clicks)
    this.clickListener = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.slot-actions-menu') && !target.closest('.slot-menu-dropdown')) {
        this.activeMenuSlot = null;
      }
    };
    setTimeout(() => {
      document.addEventListener('click', this.clickListener!);
    }, 100);
  }

  slotEventSource?: EventSource;
  private clickListener?: (event: MouseEvent) => void;

  subscribeToSlotEvents() {
    try {
      const apiUrl = environment.apiUrl || 'https://kolkata-scooty-bike-training.onrender.com/api';
      const url = `${apiUrl}/events`;
      this.slotEventSource = new EventSource(url);
      this.slotEventSource.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          const evt = payload.event as string;
          if (!evt || !evt.startsWith('slot.')) return;
          
          // Reload only for the selected date
          await this.loadSlotsForSelectedDate();
        } catch {
          /* ignore bad SSE payload */
        }
      };
    } catch {
      /* SSE optional */
    }
  }

  formatReadableDate(dateStr: string): string {
    try {
      // Parse as UTC to avoid timezone issues
      const normalized = this.normalizeDate(dateStr);
      const [year, month, day] = normalized.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  ngOnDestroy() {
    if (this.slotEventSource) {
      this.slotEventSource.close();
    }
    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener);
    }
  }

  async loadDataForSelectedDate() {
    try {
      this.trainers = await this.trainerService.getAllTrainers();
      this.onDutyTrainers = await this.trainerService.getOnDutyTrainers();
      await this.loadSlotsForSelectedDate();
    } catch {
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
        const slotDate = s.slot_date || extractDateFromDateTime(s.start_time);
        const startDate = extractDateFromDateTime(s.start_time);
        const normalizedSlotDate = this.normalizeDate(slotDate);
        const normalizedStartDate = this.normalizeDate(startDate);
        return normalizedSlotDate === this.selectedDate || normalizedStartDate === this.selectedDate;
      });
      
      // Sort slots by start time (numerically using minutes)
      this.slots.sort((a, b) => {
        const timeA = timeToMinutes(a.start_time);
        const timeB = timeToMinutes(b.start_time);
        return timeA - timeB;
      });
      
      this.filterSlots();
    } catch {
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
        const timeStr = extractTime(slot.start_time) || '';
        const formattedTime = formatTimeToAMPM(timeStr).toLowerCase();
        return trainerName.includes(term) || timeStr.includes(term) || formattedTime.includes(term);
      });
    }
    
    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(slot => slot.status === this.statusFilter);
    }
    
    // Ensure filtered slots are also sorted by time
    filtered.sort((a, b) => {
      const timeA = timeToMinutes(a.start_time);
      const timeB = timeToMinutes(b.start_time);
      return timeA - timeB;
    });
    
    this.filteredSlots = filtered;
  }

  // Available dates list removed with calendar-driven daily view

  /**
   * Find the next available date (no slots) starting from the given date
   * Checks up to 30 days ahead
   */
  async findNextAvailableDate(startDate: string): Promise<string | null> {
    const normalizedStart = this.normalizeDate(startDate);
    if (!normalizedStart) {
      return null;
    }
    
    // Check up to 30 days ahead, starting from the day after startDate
    for (let i = 1; i <= 30; i++) {
      // Use addDays utility for reliable date arithmetic
      const checkDate = addDays(normalizedStart, i);
      
      try {
        const slots = await this.slotService.getSlotsByDate(checkDate);
        if (!slots || slots.length === 0) {
          return checkDate;
        }
      } catch (error) {
        // If there's an error checking, assume no slots and return this date
        return checkDate;
      }
    }
    
    return null; // No available date found within 30 days
  }

  /**
   * Check if slots exist for the selected date and show confirmation if needed
   */
  async generateSlotsForSelectedDate() {
    if (!this.selectedDate) return;
    
    try {
      const normalizedDate = this.normalizeDate(this.selectedDate);
      const today = getToday();
      let generateDate = normalizedDate;
      if (generateDate <= today) {
        generateDate = addDays(today, 1);
        this.toastService.info(`Generation is only for future dates. Using ${this.formatReadableDate(generateDate)}.`);
      }
      
      const existingSlots = await this.slotService.getSlotsByDate(generateDate);
      
      if (existingSlots && existingSlots.length > 0) {
        const nextDate = await this.findNextAvailableDate(generateDate);
        
        if (nextDate) {
          // Show confirmation modal
          this.nextAvailableDate = nextDate;
          this.pendingGenerationDate = nextDate;
          this.showGenerateConfirmModal = true;
        } else {
          // No available date found
          this.toastService.warning('Slots already exist for this date and no available date found within 30 days.');
        }
      } else {
        await this.doGenerateSlots(generateDate);
      }
    } catch (error: any) {
      this.toastService.error(error?.error?.message || error?.message || 'Failed to check/generate slots');
    }
  }

  /**
   * Actually generate slots for the given date
   */
  async doGenerateSlots(date: string) {
    try {
      const normalizedDate = this.normalizeDate(date);
      const res = await this.slotService.generateDailySlots(normalizedDate);
      
      if (res && res.success === false) {
        this.toastService.warning(res.message || 'Slots already exist for this date.');
      } else {
        this.toastService.success('Slots generated successfully');
        // Update selectedDate to the generated date
        this.selectedDate = normalizedDate;
        await this.loadSlotsForSelectedDate();
      }
    } catch (error: any) {
      this.toastService.error(error?.error?.message || error?.message || 'Failed to generate slots');
    }
  }

  /**
   * Confirm and generate slots for the next available date
   */
  async confirmGenerateForNextDate() {
    this.showGenerateConfirmModal = false;
    if (this.pendingGenerationDate) {
      // Update selected date to the next available date
      this.selectedDate = this.pendingGenerationDate;
      await this.doGenerateSlots(this.pendingGenerationDate);
    }
    this.pendingGenerationDate = '';
    this.nextAvailableDate = '';
  }

  /**
   * Cancel the generation confirmation
   */
  cancelGenerateConfirm() {
    this.showGenerateConfirmModal = false;
    this.pendingGenerationDate = '';
    this.nextAvailableDate = '';
  }

  async createSlot() {
    try {
      // Extract date from datetime-local input (format: YYYY-MM-DDTHH:mm)
      const slotDate = extractDateFromDateTime(this.newSlot.start_time) || this.selectedDate;
      
      // Ensure times are in ISO format for backend (backend expects full datetime)
      // datetime-local input gives us YYYY-MM-DDTHH:mm, we need to add seconds and timezone
      const startTimeISO = this.newSlot.start_time.includes('T') 
        ? `${this.newSlot.start_time}:00.000Z` 
        : new Date(`${slotDate}T${this.newSlot.start_time}:00`).toISOString();
      const endTimeISO = this.newSlot.end_time.includes('T')
        ? `${this.newSlot.end_time}:00.000Z`
        : new Date(`${slotDate}T${this.newSlot.end_time}:00`).toISOString();
      
      await this.slotService.createSlot({
        trainer_id: this.newSlot.trainer_id || null,
        start_time: startTimeISO,
        end_time: endTimeISO,
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
      // Extract date from datetime-local input
      const slotDate = extractDateFromDateTime(this.editingSlot.start_time) || this.selectedDate;
      
      // Ensure times are in ISO format for backend
      const startTimeISO = this.editingSlot.start_time.includes('T')
        ? `${this.editingSlot.start_time}:00.000Z`
        : new Date(`${slotDate}T${this.editingSlot.start_time}:00`).toISOString();
      const endTimeISO = this.editingSlot.end_time.includes('T')
        ? `${this.editingSlot.end_time}:00.000Z`
        : new Date(`${slotDate}T${this.editingSlot.end_time}:00`).toISOString();
      
      await this.slotService.updateSlot(this.editingSlot.id, {
        start_time: startTimeISO,
        end_time: endTimeISO,
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
    const ok = await this.confirmDialog.confirm({
      title: 'Unassign trainer',
      message: 'Unassign trainer from this slot?',
      confirmLabel: 'Unassign',
      variant: 'warning'
    });
    if (!ok) return;
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
    const ok = await this.confirmDialog.confirm({
      title: 'Delete slot',
      message: 'Delete this slot? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!ok) return;
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
          Authorization: `Bearer ${getAuthToken() || ''}`
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

  formatDateTime(datetime: string, slotDate?: string) {
    // Use slot_date if available (it's the correct date), otherwise extract from datetime
    // slot_date is stored as DATE in database and represents the actual slot date
    let date: string | null;
    if (slotDate) {
      date = normalizeDate(slotDate);
    } else {
      // If no slot_date, extract from datetime but convert UTC to IST first
      // Parse the UTC datetime and convert to IST (UTC+5:30) to get the correct date
      try {
        const utcDate = new Date(datetime);
        // Convert UTC to IST by adding 5 hours 30 minutes
        const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        date = `${year}-${month}-${day}`;
      } catch {
        date = extractDateFromDateTime(datetime);
      }
    }
    
    const time = extractTime(datetime);
    
    if (!date || !time) {
      return '';
    }
    
    // Format date part
    const [year, month, day] = date.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${monthNames[month - 1]} ${day}, ${year}`;
    
    // Format time part (time is already extracted correctly from UTC timestamp)
    const formattedTime = formatTimeToAMPM(time);
    
    return `${formattedDate}, ${formattedTime}`;
  }

  formatTime(datetime: string) {
    return formatTimeToAMPM(datetime);
  }

  formatTimeOnly(datetime: string) {
    return formatTimeToAMPM(datetime);
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

  toggleSlotMenu(slotId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.activeMenuSlot = this.activeMenuSlot === slotId ? null : slotId;
  }

  editSlotFromMenu(slot: Slot) {
    this.activeMenuSlot = null;
    this.editSlot(slot);
  }

  async toggleSlotEnableFromMenu(slot: Slot) {
    this.activeMenuSlot = null;
    await this.toggleSlotEnable(slot);
  }

  adjustCapacityFromMenu(slot: Slot) {
    this.activeMenuSlot = null;
    this.selectedSlot = slot;
    // Extract date and time for datetime-local input
    const slotDate = slot.slot_date || extractDateFromDateTime(slot.start_time) || this.selectedDate;
    const startTime = extractTime(slot.start_time) || '00:00';
    const endTime = extractTime(slot.end_time) || '00:00';
    
    this.editingSlot = {
      id: slot.id,
      start_time: `${slotDate}T${startTime}`,
      end_time: `${slotDate}T${endTime}`,
      capacity: slot.capacity,
      status: slot.status
    };
    this.showEditModal = true;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'available': 'Active',
      'disabled': 'Disabled',
      'full': 'Full',
      'cancelled': 'Cancelled',
      'completed': 'Completed'
    };
    return labels[status] || status;
  }

  getCapacityPercent(slot: Slot): number {
    if (!slot.capacity || slot.capacity === 0) return 0;
    return Math.min((slot.booked_count / slot.capacity) * 100, 100);
  }

  /**
   * PHASE 3: Navigate to previous or next day using centralized date utilities
   * This ensures exactly 1 day movement regardless of timezone
   */
  navigateDate(days: number) {
    if (!this.selectedDate) {
      this.selectedDate = getToday();
      this.onSelectedDateChange();
      return;
    }
    
    // PHASE 3: Use centralized utility for date arithmetic
    const currentDate = normalizeDate(this.selectedDate);
    if (!currentDate) {
      this.selectedDate = getToday();
      this.onSelectedDateChange();
      return;
    }
    
    // Add/subtract days using utility (always moves exactly N days)
    this.selectedDate = addDays(currentDate, days);
    this.onSelectedDateChange();
  }

  /**
   * Navigate to today's date using UTC normalization
   */
  goToToday() {
    this.selectedDate = this.getDefaultDate();
    this.onSelectedDateChange();
  }

  vehicleRows(slot: Slot | null | undefined): { vehicle_id: string; vehicle_name: string; capacity: number; booked: number }[] {
    const raw = slot?.vehicle_capacities as unknown;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(
      (x: any) => x && x.vehicle_id && typeof x.capacity === 'number'
    ) as { vehicle_id: string; vehicle_name: string; capacity: number; booked: number }[];
  }

  openVehicleCapacityModal(vc: { vehicle_id: string; vehicle_name: string; capacity: number; booked: number }) {
    this.selectedVehicleRow = vc;
    this.newVehicleCapacity = vc.capacity;
    this.showVehicleCapacityModal = true;
  }

  /** Fallback when API has no vehicle_capacities (legacy DB) */
  openVehicleCapacityModalLegacy(vehicleType: 'ELECTRIC' | 'PETROL' | 'BIKE') {
    if (!this.selectedSlot) return;
    const id = `legacy-${vehicleType}`;
    const cap =
      vehicleType === 'ELECTRIC'
        ? this.selectedSlot.electric_capacity || 3
        : vehicleType === 'PETROL'
          ? this.selectedSlot.petrol_capacity || 1
          : this.selectedSlot.bike_capacity || 1;
    const booked =
      vehicleType === 'ELECTRIC'
        ? this.selectedSlot.electric_booked || 0
        : vehicleType === 'PETROL'
          ? this.selectedSlot.petrol_booked || 0
          : this.selectedSlot.bike_booked || 0;
    this.openVehicleCapacityModal({
      vehicle_id: id,
      vehicle_name: vehicleType,
      capacity: cap,
      booked
    });
  }

  closeVehicleCapacityModal() {
    this.showVehicleCapacityModal = false;
    this.selectedVehicleRow = null;
    this.newVehicleCapacity = 0;
  }

  async updateVehicleCapacity() {
    if (!this.selectedSlot || !this.selectedVehicleRow || !this.newVehicleCapacity) return;
    if (String(this.selectedVehicleRow.vehicle_id).startsWith('legacy-')) {
      this.toastService.warning('Run DB migration for slot_vehicle_capacity to edit per-vehicle limits.');
      this.closeVehicleCapacityModal();
      return;
    }

    try {
      await this.slotService.updateVehicleCapacity(this.selectedSlot.id, {
        [this.selectedVehicleRow.vehicle_id]: this.newVehicleCapacity
      });
      this.toastService.success('Vehicle capacity updated');
      this.closeVehicleCapacityModal();
      await this.loadSlotsForSelectedDate();

      const updatedSlot = this.slots.find(s => s.id === this.selectedSlot!.id);
      if (updatedSlot) {
        this.selectedSlot = updatedSlot;
      }
    } catch (error: any) {
      this.toastService.error(error?.error?.message || error?.message || 'Failed to update vehicle capacity');
    }
  }
}
