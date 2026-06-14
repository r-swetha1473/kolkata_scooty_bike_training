import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';
import { PermissionService } from '../../../services/permission.service';
import { ToastService } from '../../../services/toast.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { categorizeVehicleName } from '../../../utils/vehicle.utils';

@Component({
  selector: 'app-admin-booking-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="open" (click)="close()">
      <div class="modal-card details-modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <div>
            <h2>Booking Details</h2>
            <p class="ref-line" *ngIf="booking?.offline_reference_number">{{ booking.offline_reference_number }}</p>
          </div>
          <button type="button" class="close-btn" (click)="close()" aria-label="Close">×</button>
        </div>

        <p *ngIf="loading" class="loading-hint">Loading…</p>

        <ng-container *ngIf="!loading && booking">
          <div class="badge-row">
            <span class="source-badge" [class.online]="booking.booking_source !== 'OFFLINE'" [class.offline]="booking.booking_source === 'OFFLINE'">
              {{ booking.booking_source === 'OFFLINE' ? 'OFFLINE' : 'ONLINE' }}
            </span>
            <span class="status-badge" [class]="'status-' + booking.status">{{ booking.status }}</span>
            <span class="attendance-badge">{{ formatAttendance(booking.attendance_status) }}</span>
            <span class="over-capacity-badge" *ngIf="booking.slot?.capacity_exceeded">OVER CAPACITY</span>
          </div>

          <section class="customer-section">
            <h3>Customer Information</h3>
            <div class="detail-grid">
              <div><label>Name</label><strong>{{ booking.customer?.name || getCustomerName() }}</strong></div>
              <div><label>Phone</label><span>{{ booking.customer?.phone || booking.phone || '—' }}</span></div>
              <div><label>Source</label><span>{{ booking.customer?.source || (booking.booking_source === 'OFFLINE' ? 'Offline' : 'Online') }}</span></div>
            </div>
          </section>

          <section class="history-section" *ngIf="booking.customer_history">
            <h3>Customer History</h3>
            <div class="history-grid">
              <div><label>Total Bookings</label><strong>{{ booking.customer_history.total_bookings || 0 }}</strong></div>
              <div><label>Attended Sessions</label><strong>{{ booking.customer_history.attended_sessions || 0 }}</strong></div>
              <div><label>No Shows</label><strong>{{ booking.customer_history.no_shows || 0 }}</strong></div>
              <div><label>Cancelled Bookings</label><strong>{{ booking.customer_history.cancelled_bookings || 0 }}</strong></div>
              <div><label>Last Booking Date</label><span>{{ formatDateOnly(booking.customer_history.last_booking_date) }}</span></div>
              <div><label>Next Booking Date</label><span>{{ formatDateOnly(booking.customer_history.next_booking_date) }}</span></div>
            </div>
          </section>

          <div class="detail-grid booking-detail-grid">
            <div><label>Customer</label><strong>{{ getCustomerName() }}</strong></div>
            <div><label>Phone</label><span>{{ booking.phone || '—' }}</span></div>
            <div><label>Vehicle</label><span>{{ getVehicleLabel() }}</span></div>
            <div><label>Trainer</label><span>{{ booking.trainer_name || 'Unassigned' }}</span></div>
            <div><label>Slot</label><span>{{ formatDateTime(booking.start_time) }}</span></div>
            <div><label>Booking Status</label><span>{{ booking.status }}</span></div>
          </div>

          <section class="audit-section">
            <h3>Audit Trail</h3>
            <div class="audit-grid">
              <div><label>Created By</label><span>{{ booking.audit?.created_by || '—' }}</span></div>
              <div><label>Created At</label><span>{{ formatDateTime(booking.audit?.created_at) }}</span></div>
              <div><label>Updated By</label><span>{{ booking.audit?.updated_by || '—' }}</span></div>
              <div><label>Updated At</label><span>{{ formatDateTime(booking.audit?.updated_at) }}</span></div>
              <div><label>Attendance Updated By</label><span>{{ booking.audit?.attendance_updated_by || '—' }}</span></div>
              <div><label>Attendance Updated At</label><span>{{ formatDateTime(booking.audit?.attendance_updated_at) }}</span></div>
            </div>
          </section>

          <section class="attendance-section" *ngIf="perms.can('bookings', 'edit')">
            <h3>Attendance</h3>
            <div class="attendance-controls">
              <select [(ngModel)]="attendanceDraft" class="admin-select">
                <option value="SCHEDULED">Scheduled</option>
                <option value="ATTENDED">Attended</option>
                <option value="NO_SHOW">No Show</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button type="button" class="admin-btn admin-btn-primary" (click)="saveAttendance()" [disabled]="savingAttendance">
                {{ savingAttendance ? 'Saving…' : 'Update Attendance' }}
              </button>
            </div>
          </section>

          <section class="timeline-section" *ngIf="booking.timeline?.length">
            <h3>Activity Timeline</h3>
            <div class="timeline">
              <article class="timeline-item" *ngFor="let event of booking.timeline">
                <div class="timeline-dot"></div>
                <div class="timeline-body">
                  <div class="timeline-time">{{ formatDateTime(event.created_at) }}</div>
                  <div class="timeline-title">{{ event.title }}</div>
                  <div class="timeline-desc" *ngIf="event.description">{{ event.description }}</div>
                  <div class="timeline-actor" *ngIf="event.actor_name">By {{ event.actor_name }}</div>
                </div>
              </article>
            </div>
          </section>

          <div class="capacity-warn over-capacity-alert" *ngIf="booking.slot?.capacity_exceeded">
            <span class="over-capacity-badge">OVER CAPACITY</span>
            Current bookings exceed active vehicle capacity. Existing bookings are preserved; no new bookings should be added until resolved.
          </div>
        </ng-container>

        <div class="modal-actions">
          <button type="button" class="admin-btn admin-btn-secondary" (click)="close()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1200; padding: 16px;
    }
    .details-modal {
      width: min(720px, 100%); max-height: 90vh; overflow: auto;
      background: #fff; border-radius: 14px; padding: 20px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.2);
    }
    .modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .modal-head h2 { margin: 0; font-size: 20px; }
    .ref-line { margin: 4px 0 0; color: #6b7280; font-size: 13px; font-weight: 600; }
    .close-btn { border: none; background: transparent; font-size: 28px; line-height: 1; cursor: pointer; color: #6b7280; }
    .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .source-badge, .attendance-badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    }
    .source-badge.online { background: #d1fae5; color: #065f46; }
    .source-badge.offline { background: #ffedd5; color: #9a3412; }
    .attendance-badge { background: #eff6ff; color: #1d4ed8; }
    .over-capacity-badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.05em;
      background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;
    }
    .customer-section, .history-section { margin-top: 16px; }
    .customer-section h3, .history-section h3 { margin: 0 0 12px; font-size: 15px; }
    .history-grid {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
    }
    .history-grid label {
      display: block; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px;
    }
    .booking-detail-grid { margin-top: 16px; }
    .detail-grid, .audit-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
    }
    .detail-grid label, .audit-grid label {
      display: block; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.04em; color: #6b7280; margin-bottom: 2px;
    }
    .audit-section, .attendance-section, .timeline-section { margin-top: 20px; }
    .audit-section h3, .attendance-section h3, .timeline-section h3 {
      margin: 0 0 12px; font-size: 15px;
    }
    .attendance-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .timeline { display: flex; flex-direction: column; gap: 12px; }
    .timeline-item { display: flex; gap: 10px; }
    .timeline-dot {
      width: 10px; height: 10px; border-radius: 50%; background: var(--admin-primary, #0066B1);
      margin-top: 6px; flex-shrink: 0;
    }
    .timeline-time { font-size: 12px; color: #6b7280; }
    .timeline-title { font-weight: 600; color: #111827; }
    .timeline-desc, .timeline-actor { font-size: 13px; color: #4b5563; }
    .capacity-warn {
      margin-top: 16px; padding: 12px; border-radius: 10px;
      background: #fef3c7; color: #92400e; font-size: 13px;
    }
    .over-capacity-alert {
      background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
    }
    .modal-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
    .loading-hint { color: #6b7280; }
    @media (max-width: 640px) {
      .detail-grid, .audit-grid, .history-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AdminBookingDetailsModalComponent implements OnChanges {
  @Input() open = false;
  @Input() bookingId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  booking: any = null;
  loading = false;
  savingAttendance = false;
  attendanceDraft = 'SCHEDULED';

  constructor(
    private adminService: AdminService,
    public perms: PermissionService,
    private toastService: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['open'] || changes['bookingId']) && this.open && this.bookingId) {
      void this.load();
    }
  }

  async load() {
    if (!this.bookingId) return;
    this.loading = true;
    try {
      this.booking = await this.adminService.getBookingDetail(this.bookingId);
      this.attendanceDraft = this.booking?.attendance_status || 'SCHEDULED';
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to load booking details'));
      this.close();
    } finally {
      this.loading = false;
    }
  }

  async saveAttendance() {
    if (!this.bookingId || this.savingAttendance) return;
    this.savingAttendance = true;
    try {
      await this.adminService.updateBookingAttendance(this.bookingId, this.attendanceDraft);
      this.toastService.success('Attendance updated');
      await this.load();
      this.updated.emit();
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to update attendance'));
    } finally {
      this.savingAttendance = false;
    }
  }

  getCustomerName(): string {
    if (!this.booking) return '';
    if (this.booking.booking_source === 'OFFLINE') {
      return this.booking.offline_customer_name || 'Walk-in customer';
    }
    return this.booking.user_name || this.booking.user?.full_name || 'N/A';
  }

  getVehicleLabel(): string {
    const name = this.booking?.vehicle_name || '';
    const cat = categorizeVehicleName(name);
    if (cat === 'ev_scooty') return 'Electric Scooty';
    if (cat === 'petrol_scooty') return 'Petrol Scooty';
    if (cat === 'bike') return 'Bike';
    return name || 'N/A';
  }

  formatAttendance(value?: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Scheduled',
      ATTENDED: 'Attended',
      NO_SHOW: 'No Show',
      CANCELLED: 'Cancelled'
    };
    return map[String(value || 'SCHEDULED').toUpperCase()] || value || 'Scheduled';
  }

  formatDateTime(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  }

  formatDateOnly(value?: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
  }

  close() {
    this.open = false;
    this.closed.emit();
  }
}
