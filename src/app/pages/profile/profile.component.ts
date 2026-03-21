import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { BookingService } from '../../services/booking.service';
import { HttpService } from '../../services/http.service';
import { firstValueFrom } from 'rxjs';
import { extractDateFromDateTime, extractTime, formatTimeToAMPM, isPastDateTime, calculateDurationMinutes } from '../../utils/date.utils';

export interface Booking {
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
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="profile-page">
      <div *ngIf="loading && !userProfile" class="loading">Loading profile...</div>
      <div class="profile-header" *ngIf="userProfile">
        <div class="profile-avatar">
          <img 
            *ngIf="userProfile?.avatar_url" 
            [src]="userProfile.avatar_url" 
            [alt]="userProfile.full_name"
            class="avatar-img">
          <div *ngIf="!userProfile?.avatar_url" class="avatar-placeholder">
            {{ getInitials(userProfile?.full_name || '') }}
          </div>
        </div>
        <div class="profile-info">
          <h1 class="profile-name">{{ userProfile?.full_name || 'User' }}</h1>
          <p class="profile-email">{{ userProfile?.email }}</p>
          <p *ngIf="userProfile?.phone && !userProfile.phone.startsWith('GOOGLE_')" class="profile-phone">{{ userProfile.phone }}</p>
        </div>
      </div>

      <div class="bookings-section">
        <h2 class="section-title">My Bookings</h2>
        
        <div *ngIf="loading" class="loading">Loading bookings...</div>
        
        <div *ngIf="!loading && bookings.length === 0" class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No bookings found</p>
          <a routerLink="/booking" class="btn-primary">Book a Slot</a>
        </div>

        <div *ngIf="!loading && bookings.length > 0" class="bookings-list">
          <div class="bookings-tabs">
            <h3>Upcoming Bookings</h3>
            <div *ngFor="let booking of getUpcomingBookings()" class="booking-card">
            <div class="booking-header">
              <div class="booking-trainer">
                <img 
                  *ngIf="booking.trainer_avatar" 
                  [src]="booking.trainer_avatar" 
                  [alt]="booking.trainer_name"
                  class="trainer-avatar-small">
                <span class="trainer-name">{{ booking.trainer_name }}</span>
              </div>
              <span class="status-badge" [class]="'status-' + booking.status">
                {{ booking.status }}
              </span>
            </div>
            
            <div class="booking-details">
              <div class="booking-time">
                <span class="time-label">Date & Time:</span>
                <span class="time-value">{{ formatDateTime(booking.start_time) }}</span>
              </div>
              <div class="booking-duration">
                <span class="duration-label">Duration:</span>
                <span class="duration-value">{{ formatDuration(booking.start_time, booking.end_time) }}</span>
              </div>
              <div class="booking-vehicle" *ngIf="booking.vehicle_name">
                <span class="vehicle-label">Vehicle:</span>
                <span class="vehicle-value">{{ booking.vehicle_name }} ({{ booking.vehicle_type }})</span>
              </div>
              <div *ngIf="booking.notes" class="booking-notes">
                <span class="notes-label">Notes:</span>
                <span class="notes-value">{{ booking.notes }}</span>
              </div>
              <div *ngIf="booking.cancellation_reason" class="cancellation-reason">
                <span class="reason-label">Cancellation Reason:</span>
                <span class="reason-value">{{ booking.cancellation_reason }}</span>
              </div>
            </div>

            <div class="booking-actions">
              <button 
                *ngIf="canCancelBooking(booking)"
                class="btn-cancel" 
                (click)="showCancelModal(booking)">
                Cancel Booking
              </button>
              <button 
                *ngIf="canRateBooking(booking)"
                class="btn-rate" 
                (click)="openRatingModal(booking)">
                Rate This Class
              </button>
            </div>
          </div>
          <h3 class="past-bookings-title">Past Bookings</h3>
          <div *ngFor="let booking of getPastBookings()" class="booking-card past">
            <div class="booking-header">
              <div class="booking-trainer">
                <img 
                  *ngIf="booking.trainer_avatar" 
                  [src]="booking.trainer_avatar" 
                  [alt]="booking.trainer_name"
                  class="trainer-avatar-small">
                <span class="trainer-name">{{ booking.trainer_name }}</span>
              </div>
              <span class="status-badge" [class]="'status-' + booking.status">
                {{ booking.status }}
              </span>
            </div>
            
            <div class="booking-details">
              <div class="booking-time">
                <span class="time-label">Date & Time:</span>
                <span class="time-value">{{ formatDateTime(booking.start_time) }}</span>
              </div>
              <div class="booking-duration">
                <span class="duration-label">Duration:</span>
                <span class="duration-value">{{ formatDuration(booking.start_time, booking.end_time) }}</span>
              </div>
              <div class="booking-vehicle" *ngIf="booking.vehicle_name">
                <span class="vehicle-label">Vehicle:</span>
                <span class="vehicle-value">{{ booking.vehicle_name }} ({{ booking.vehicle_type }})</span>
              </div>
              <div *ngIf="booking.notes" class="booking-notes">
                <span class="notes-label">Notes:</span>
                <span class="notes-value">{{ booking.notes }}</span>
              </div>
              <div *ngIf="booking.cancellation_reason" class="cancellation-reason">
                <span class="reason-label">Cancellation Reason:</span>
                <span class="reason-value">{{ booking.cancellation_reason }}</span>
              </div>
            </div>

            <div class="booking-actions">
              <button 
                *ngIf="canRateBooking(booking)"
                class="btn-rate" 
                (click)="openRatingModal(booking)">
                Rate This Class
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cancel Booking Modal -->
      <div *ngIf="isCancelModalVisible" class="modal-overlay" (click)="closeCancelModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Cancel Booking</h3>
          <p>Are you sure you want to cancel this booking?</p>
          <div class="form-group">
            <label for="cancelReason">Cancellation Reason (optional):</label>
            <textarea 
              id="cancelReason"
              [(ngModel)]="cancelReason" 
              rows="3"
              placeholder="Please provide a reason for cancellation...">
            </textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeCancelModal()">Keep Booking</button>
            <button class="btn-danger" (click)="confirmCancel()" [disabled]="cancelling">
              {{ cancelling ? 'Cancelling...' : 'Cancel Booking' }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- Rating Modal -->
      <div *ngIf="isRatingModalVisible" class="modal-overlay" (click)="closeRatingModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Rate Your Class</h3>
          <div class="form-group">
            <label>Rating (1-5)</label>
            <div class="star-rating">
              <button 
                *ngFor="let star of [1,2,3,4,5]" 
                type="button"
                class="star-btn"
                [class.active]="star <= ratingValue"
                (click)="ratingValue = star">
                {{ star <= ratingValue ? '⭐' : '☆' }}
              </button>
              <span class="rating-value">{{ ratingValue }} / 5</span>
            </div>
          </div>
          <div class="form-group">
            <label>Comments (optional)</label>
            <textarea rows="3" [(ngModel)]="ratingComments" placeholder="Share your feedback..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeRatingModal()">Close</button>
            <button class="btn-danger" (click)="submitRating()">Submit Rating</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 32px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 32px;
    }

    .profile-avatar {
      width: 120px;
      height: 120px;
      border-radius: var(--border-radius-full);
      overflow: hidden;
      background: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      font-size: 48px;
      font-weight: 600;
      color: var(--bmw-primary);
    }

    .profile-info {
      flex: 1;
    }

    .profile-name {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 8px 0;
    }

    .profile-email {
      font-size: 16px;
      color: var(--text-secondary);
      margin: 0 0 4px 0;
    }

    .profile-phone {
      font-size: 16px;
      color: var(--text-secondary);
      margin: 0;
    }

    .bookings-section {
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-md);
      padding: 32px;
    }

    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 24px 0;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-4xl) var(--spacing-xl);
      background: var(--bg-primary);
      border-radius: var(--border-radius-lg);
      border: 1px dashed var(--border-secondary);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: var(--spacing-lg);
      opacity: 0.4;
      color: var(--text-tertiary);
    }

    .empty-state p {
      color: var(--text-secondary);
      font-size: 1rem;
      margin-bottom: var(--spacing-lg);
    }

    .btn-primary {
      display: inline-block;
      padding: 12px 24px;
      background: var(--bmw-primary);
      color: var(--text-on-blue);
      text-decoration: none;
      border-radius: var(--border-radius-md);
      font-weight: 500;
      transition: background var(--transition-fast);
    }

    .btn-primary:hover {
      background: var(--bmw-secondary);
    }

    .bookings-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .booking-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--border-radius-lg);
      padding: 20px;
      transition: all var(--transition-fast);
      box-shadow: var(--shadow-sm);
    }

    .booking-card:hover {
      border-color: var(--border-accent);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .booking-card.past {
      opacity: 0.7;
      background: var(--bg-primary);
      border-color: var(--border-disabled);
    }

    .booking-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .booking-trainer {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .trainer-avatar-small {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .trainer-name {
      font-weight: 600;
      color: #1f2937;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-confirmed {
      background: #dbeafe;
      color: #1e40af;
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

    .booking-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .booking-time, .booking-duration, .booking-notes, .cancellation-reason {
      display: flex;
      gap: 8px;
    }

    .time-label, .duration-label, .notes-label, .reason-label {
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 120px;
    }

    .time-value, .duration-value, .notes-value, .reason-value {
      color: var(--text-primary);
    }

    .booking-actions {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-primary);
    }

    .btn-cancel {
      padding: 8px 16px;
      background: var(--status-error-bg);
      color: var(--status-error-text);
      border: none;
      border-radius: var(--border-radius-sm);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-cancel:hover:not(:disabled) {
      background: var(--status-error);
      color: white;
    }

    .btn-rate {
      padding: 8px 16px;
      background: var(--status-info-bg);
      color: var(--status-info-text);
      border: none;
      border-radius: var(--border-radius-sm);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-rate:hover:not(:disabled) {
      background: var(--bmw-primary);
      color: var(--text-on-blue);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
    }

    .modal-content h3 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 16px 0;
    }

    .modal-content p {
      color: var(--text-secondary);
      margin-bottom: 24px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group label {
      display: block;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid var(--border-primary);
      border-radius: var(--border-radius-md);
      font-family: inherit;
      resize: vertical;
    }

    .form-group textarea:focus {
      outline: none;
      border-color: var(--border-accent);
      box-shadow: var(--shadow-focus);
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn-secondary {
      padding: 10px 20px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-primary);
      border-radius: var(--border-radius-md);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-accent);
    }

    .btn-danger {
      padding: 10px 20px;
      background: var(--status-error);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-danger:hover:not(:disabled) {
      background: #DC2626;
      box-shadow: var(--shadow-md);
    }

    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: var(--bg-tertiary);
      color: var(--text-tertiary);
    }

    .star-rating {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .star-btn {
      background: none;
      border: none;
      font-size: 32px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: transform 0.2s;
    }

    .star-btn:hover {
      transform: scale(1.2);
    }

    .rating-value {
      margin-left: 12px;
      font-weight: 600;
      color: #1f2937;
    }

    @media (max-width: 768px) {
      .profile-header {
        flex-direction: column;
        text-align: center;
      }

      .booking-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
    }
  `]
})
export class ProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  bookings: Booking[] = [];
  loading = false;
  isCancelModalVisible = false;
  selectedBooking: Booking | null = null;
  cancelReason = '';
  cancelling = false;
  // rating modal
  isRatingModalVisible = false;
  ratingValue: number = 5;
  ratingComments: string = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private bookingService: BookingService,
    private httpService: HttpService
  ) {}

  async ngOnInit() {
    this.loading = true;
    try {
      const oauthToken = this.route.snapshot.queryParamMap.get('token');
      console.log('OAuth token from query params:', oauthToken);
      if (oauthToken) {
        localStorage.setItem('token', oauthToken);
        // Keep sessionStorage in sync because current auth headers use sessionStorage.
        sessionStorage.setItem('token', oauthToken);
      }

      // Check if user profile is already loaded
      this.userProfile = this.authService.getUserProfile();
      
      // If no profile, try to load from API (handles httpOnly cookie from OAuth)
      if (!this.userProfile) {
        try {
          const profile = await firstValueFrom(this.httpService.get<UserProfile>('/auth/me'));
          if (profile) {
            this.userProfile = profile;
            // Update auth service state
            (this.authService as any).userProfileSubject.next(profile);
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
        }
      }

      // Subscribe to profile changes
      this.authService.userProfile$.subscribe(profile => {
        this.userProfile = profile;
      });

      await this.loadBookings();
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadBookings() {
    try {
      const bookings = await firstValueFrom(this.apiService.getMyBookings());
      // Map the API response to match our Booking interface
      this.bookings = (bookings || []).map((booking: any) => ({
        id: booking.id,
        slot_id: booking.slot_id,
        trainer_id: booking.trainer_id,
        status: booking.status,
        notes: booking.notes || '',
        start_time: booking.start_time,
        end_time: booking.end_time,
        slot_date: booking.slot_date,
        trainer_name: booking.trainer_name || 'Unknown Trainer',
        trainer_avatar: booking.trainer_avatar,
        vehicle_name: booking.vehicle_name || 'Not specified',
        vehicle_type: booking.vehicle_type || '',
        created_at: booking.created_at || new Date().toISOString(),
        cancellation_reason: booking.cancellation_reason,
        cancelled_at: booking.cancelled_at
      }));
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  formatDateTime(datetimeString: string): string {
    // Extract date and time parts
    const date = extractDateFromDateTime(datetimeString);
    const time = extractTime(datetimeString);
    
    if (!date || !time) {
      return '';
    }
    
    // Format date part
    const [year, month, day] = date.split('-').map(Number);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Get day of week (0=Sunday, 6=Saturday)
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = dayNames[dateObj.getUTCDay()];
    
    const formattedDate = `${dayOfWeek}, ${monthNames[month - 1]} ${day}, ${year}`;
    const formattedTime = formatTimeToAMPM(time);
    
    return `${formattedDate}, ${formattedTime}`;
  }

  formatDuration(start: string, end: string): string {
    const diffMins = calculateDurationMinutes(start, end);
    return `${diffMins} minutes`;
  }

  isPastBooking(booking: Booking): boolean {
    return isPastDateTime(booking.start_time);
  }

  getUpcomingBookings(): Booking[] {
    return this.bookings.filter(b => !this.isPastBooking(b) && b.status !== 'cancelled' && b.status !== 'completed');
  }

  getPastBookings(): Booking[] {
    return this.bookings.filter(b => this.isPastBooking(b) || b.status === 'completed');
  }

  canCancelBooking(booking: Booking): boolean {
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return false;
    }
    return !isPastDateTime(booking.start_time);
  }

  canRateBooking(booking: Booking): boolean {
    return booking.status === 'completed';
  }

  showCancelModal(booking: Booking) {
    this.selectedBooking = booking;
    this.isCancelModalVisible = true;
    this.cancelReason = '';
  }

  closeCancelModal() {
    this.isCancelModalVisible = false;
    this.selectedBooking = null;
    this.cancelReason = '';
  }

  async confirmCancel() {
    if (!this.selectedBooking) return;

    this.cancelling = true;
    try {
      await firstValueFrom(this.apiService.cancelBooking(this.selectedBooking.id, this.cancelReason));
      this.closeCancelModal();
      await this.loadBookings();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      alert(error.error?.error || error.message || 'Failed to cancel booking');
    } finally {
      this.cancelling = false;
    }
  }

  // Rating handlers
  openRatingModal(booking: Booking) {
    this.selectedBooking = booking;
    this.ratingValue = 5;
    this.ratingComments = '';
    this.isRatingModalVisible = true;
  }

  closeRatingModal() {
    this.isRatingModalVisible = false;
    this.selectedBooking = null;
    this.ratingComments = '';
  }

  async submitRating() {
    if (!this.selectedBooking) return;
    try {
      const res = await firstValueFrom(this.apiService.submitRating(this.selectedBooking.id, this.ratingValue, this.ratingComments));
      this.closeRatingModal();
      await this.loadBookings();
      alert('Thank you for your rating!');
    } catch (error: any) {
      alert(error?.error?.error || 'Failed to submit rating');
    }
  }
}

