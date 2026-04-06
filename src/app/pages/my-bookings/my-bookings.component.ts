import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api.service';
import {
  extractDateFromDateTime,
  extractTime,
  formatTimeToAMPM,
  isPastDateTime,
  calculateDurationMinutes
} from '../../utils/date.utils';

export interface BookingRow {
  id: string;
  slot_id: string;
  trainer_id: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  start_time: string;
  end_time: string;
  slot_date?: string;
  trainer_name: string;
  trainer_avatar?: string;
  vehicle_name?: string;
  vehicle_type?: string;
  created_at: string;
  cancellation_reason?: string;
  cancelled_at?: string;
}

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="my-bookings-page">
      <div class="page-head">
        <h1>My Bookings</h1>
        <p class="sub">Only your bookings are shown here.</p>
        <a routerLink="/booking" class="btn-primary">Book a slot</a>
      </div>

      <div *ngIf="loading" class="loading">Loading bookings…</div>

      <div *ngIf="!loading && bookings.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No bookings yet.</p>
        <a routerLink="/booking" class="btn-primary">Book a Slot</a>
      </div>

      <div *ngIf="!loading && bookings.length > 0" class="bookings-list">
        <h2 class="section-title">Upcoming</h2>
        <div *ngFor="let b of getUpcomingBookings()" class="booking-card">
          <div class="booking-header">
            <div class="booking-trainer">
              <img
                *ngIf="b.trainer_avatar"
                [src]="b.trainer_avatar"
                [alt]="b.trainer_name"
                class="trainer-avatar-small" />
              <span class="trainer-name">{{ b.trainer_name }}</span>
            </div>
            <span class="status-badge" [class]="'status-' + b.status">{{ b.status }}</span>
          </div>
          <div class="booking-details">
            <div class="row">
              <span class="label">Date &amp; time</span>
              <span>{{ formatDateTime(b.start_time) }}</span>
            </div>
            <div class="row">
              <span class="label">Duration</span>
              <span>{{ formatDuration(b.start_time, b.end_time) }}</span>
            </div>
            <div class="row" *ngIf="b.vehicle_name">
              <span class="label">Vehicle</span>
              <span>{{ b.vehicle_name }} ({{ b.vehicle_type }})</span>
            </div>
            <div class="row" *ngIf="b.notes">
              <span class="label">Notes</span>
              <span>{{ b.notes }}</span>
            </div>
          </div>
          <div class="booking-actions">
            <button
              *ngIf="canCancelBooking(b)"
              type="button"
              class="btn-cancel"
              (click)="openCancel(b)">
              Cancel booking
            </button>
            <button
              *ngIf="canRateBooking(b)"
              type="button"
              class="btn-rate"
              (click)="openRate(b)">
              Rate this class
            </button>
          </div>
        </div>

        <h2 class="section-title past-title">Past</h2>
        <div *ngFor="let b of getPastBookings()" class="booking-card past">
          <div class="booking-header">
            <div class="booking-trainer">
              <img
                *ngIf="b.trainer_avatar"
                [src]="b.trainer_avatar"
                [alt]="b.trainer_name"
                class="trainer-avatar-small" />
              <span class="trainer-name">{{ b.trainer_name }}</span>
            </div>
            <span class="status-badge" [class]="'status-' + b.status">{{ b.status }}</span>
          </div>
          <div class="booking-details">
            <div class="row">
              <span class="label">Date &amp; time</span>
              <span>{{ formatDateTime(b.start_time) }}</span>
            </div>
            <div class="row">
              <span class="label">Duration</span>
              <span>{{ formatDuration(b.start_time, b.end_time) }}</span>
            </div>
            <div class="row" *ngIf="b.vehicle_name">
              <span class="label">Vehicle</span>
              <span>{{ b.vehicle_name }} ({{ b.vehicle_type }})</span>
            </div>
            <div class="row" *ngIf="b.notes">
              <span class="label">Notes</span>
              <span>{{ b.notes }}</span>
            </div>
          </div>
          <div class="booking-actions">
            <button
              *ngIf="canCancelBooking(b)"
              type="button"
              class="btn-cancel"
              (click)="openCancel(b)">
              Cancel booking
            </button>
            <button
              *ngIf="canRateBooking(b)"
              type="button"
              class="btn-rate"
              (click)="openRate(b)">
              Rate this class
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="cancelOpen" class="modal-overlay" (click)="closeCancel()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Cancel booking</h3>
          <p>Are you sure you want to cancel?</p>
          <label class="sr-only" for="cancelReason">Reason (optional)</label>
          <textarea
            id="cancelReason"
            [(ngModel)]="cancelReason"
            rows="3"
            placeholder="Reason (optional)"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeCancel()">Keep booking</button>
            <button type="button" class="btn-danger" (click)="confirmCancel()" [disabled]="cancelling">
              {{ cancelling ? 'Cancelling…' : 'Cancel' }}
            </button>
          </div>
        </div>
      </div>

      <div *ngIf="rateOpen" class="modal-overlay" (click)="closeRate()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Rate your class</h3>
          <div class="stars">
            <button
              type="button"
              *ngFor="let star of [1, 2, 3, 4, 5]"
              class="star-btn"
              [class.active]="star <= ratingValue"
              (click)="ratingValue = star">
              {{ star <= ratingValue ? '⭐' : '☆' }}
            </button>
            <span class="rating-value">{{ ratingValue }} / 5</span>
          </div>
          <textarea rows="3" [(ngModel)]="ratingComments" placeholder="Comments (optional)"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeRate()">Close</button>
            <button type="button" class="btn-danger" (click)="submitRating()">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .my-bookings-page {
        max-width: 900px;
        margin: 0 auto;
        padding: 24px;
      }
      .page-head {
        margin-bottom: 28px;
      }
      .page-head h1 {
        margin: 0 0 8px 0;
        font-size: 28px;
        color: var(--text-primary);
      }
      .sub {
        color: var(--text-secondary);
        margin: 0 0 16px 0;
      }
      .btn-primary {
        display: inline-block;
        padding: 10px 20px;
        background: var(--bmw-primary);
        color: var(--text-on-blue);
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        border: none;
        cursor: pointer;
      }
      .loading,
      .empty-state {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-secondary);
      }
      .empty-icon {
        font-size: 3rem;
        opacity: 0.45;
        margin-bottom: 12px;
      }
      .section-title {
        font-size: 18px;
        margin: 24px 0 12px 0;
        color: var(--text-primary);
      }
      .past-title {
        margin-top: 36px;
      }
      .booking-card {
        border: 1px solid var(--border-primary);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 14px;
        background: var(--bg-primary);
        box-shadow: var(--shadow-sm);
      }
      .booking-card.past {
        opacity: 0.85;
      }
      .booking-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .booking-trainer {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .trainer-avatar-small {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
      .trainer-name {
        font-weight: 600;
      }
      .status-badge {
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .status-confirmed {
        background: #dbeafe;
        color: #1e40af;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      .status-completed {
        background: #d1fae5;
        color: #065f46;
      }
      .status-cancelled {
        background: #fee2e2;
        color: #991b1b;
      }
      .status-no_show {
        background: #f3f4f6;
        color: #374151;
      }
      .booking-details .row {
        display: flex;
        gap: 12px;
        margin-bottom: 6px;
        font-size: 14px;
      }
      .label {
        min-width: 100px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .booking-actions {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border-primary);
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn-cancel {
        padding: 8px 14px;
        background: var(--status-error-bg, #fee2e2);
        color: var(--status-error-text, #991b1b);
        border: none;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
      }
      .btn-rate {
        padding: 8px 14px;
        background: var(--status-info-bg, #e0f2fe);
        color: var(--status-info-text, #0369a1);
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
      }
      .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 440px;
        width: 100%;
      }
      .modal-content h3 {
        margin-top: 0;
      }
      .modal-content textarea {
        width: 100%;
        margin: 12px 0;
        padding: 10px;
        border: 2px solid var(--border-primary);
        border-radius: 8px;
        font-family: inherit;
      }
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 12px;
      }
      .btn-secondary {
        padding: 8px 16px;
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        background: var(--bg-secondary);
        cursor: pointer;
      }
      .btn-danger {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: var(--status-error, #dc2626);
        color: white;
        cursor: pointer;
      }
      .stars {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 12px 0;
      }
      .star-btn {
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        padding: 0;
      }
      .rating-value {
        margin-left: 8px;
        font-weight: 600;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
      }
    `
  ]
})
export class MyBookingsComponent implements OnInit {
  bookings: BookingRow[] = [];
  loading = false;
  cancelOpen = false;
  rateOpen = false;
  selected: BookingRow | null = null;
  cancelReason = '';
  cancelling = false;
  ratingValue = 5;
  ratingComments = '';

  constructor(private apiService: ApiService) {}

  async ngOnInit() {
    this.loading = true;
    try {
      await this.loadBookings();
    } finally {
      this.loading = false;
    }
  }

  async loadBookings() {
    const raw = await firstValueFrom(this.apiService.getMyBookings());
    this.bookings = (raw || []).map((b: any) => ({
      id: b.id,
      slot_id: b.slot_id,
      trainer_id: b.trainer_id,
      status: b.status,
      notes: b.notes || '',
      start_time: b.start_time,
      end_time: b.end_time,
      slot_date: b.slot_date,
      trainer_name: b.trainer_name || 'Trainer',
      trainer_avatar: b.trainer_avatar,
      vehicle_name: b.vehicle_name || '',
      vehicle_type: b.vehicle_type || '',
      created_at: b.created_at || new Date().toISOString(),
      cancellation_reason: b.cancellation_reason,
      cancelled_at: b.cancelled_at
    }));
  }

  isPastBooking(b: BookingRow): boolean {
    return isPastDateTime(b.start_time);
  }

  getUpcomingBookings(): BookingRow[] {
    return this.bookings.filter(
      (b) => !this.isPastBooking(b) && b.status !== 'cancelled' && b.status !== 'completed'
    );
  }

  getPastBookings(): BookingRow[] {
    return this.bookings.filter((b) => this.isPastBooking(b) || b.status === 'completed');
  }

  canCancelBooking(b: BookingRow): boolean {
    if (b.status === 'cancelled' || b.status === 'completed') return false;
    return !isPastDateTime(b.start_time);
  }

  canRateBooking(b: BookingRow): boolean {
    return b.status === 'completed';
  }

  formatDateTime(iso: string): string {
    const date = extractDateFromDateTime(iso);
    const time = extractTime(iso);
    if (!date || !time) return '';
    const [y, m, d] = date.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dow = days[dateObj.getUTCDay()];
    return `${dow}, ${months[m - 1]} ${d}, ${y}, ${formatTimeToAMPM(time)}`;
  }

  formatDuration(start: string, end: string): string {
    return `${calculateDurationMinutes(start, end)} minutes`;
  }

  openCancel(b: BookingRow) {
    this.selected = b;
    this.cancelReason = '';
    this.cancelOpen = true;
  }

  closeCancel() {
    this.cancelOpen = false;
    this.selected = null;
  }

  async confirmCancel() {
    if (!this.selected) return;
    this.cancelling = true;
    try {
      await firstValueFrom(
        this.apiService.cancelBooking(this.selected.id, this.cancelReason)
      );
      this.closeCancel();
      await this.loadBookings();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Could not cancel';
      alert(msg);
    } finally {
      this.cancelling = false;
    }
  }

  openRate(b: BookingRow) {
    this.selected = b;
    this.ratingValue = 5;
    this.ratingComments = '';
    this.rateOpen = true;
  }

  closeRate() {
    this.rateOpen = false;
    this.selected = null;
  }

  async submitRating() {
    if (!this.selected) return;
    try {
      await firstValueFrom(
        this.apiService.submitRating(this.selected.id, this.ratingValue, this.ratingComments)
      );
      this.closeRate();
      await this.loadBookings();
    } catch (e: any) {
      alert(e?.error?.message || 'Could not submit rating');
    }
  }
}
