import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { TrainerService, Trainer } from '../../services/trainer.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { environment } from '../../../environments/environment';
import { normalizeDate, addDays, getToday, formatTimeToAMPM, timeToMinutes, extractTime, extractDateFromDateTime } from '../../utils/date.utils';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, CaptchaComponent],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit, OnDestroy {
  slots: Slot[] = [];
  selectedDate: string = '';
  selectedSlot: Slot | null = null;
  showBookingModal = false;
  showConfirmation = false;
  showLoginPrompt = false;
  captchaVerified = false;
  loading = false;
  errorMessage = '';
  refreshInterval: any;
  slotEvents?: EventSource;
  trainers: Trainer[] = [];
  vehicles: any[] = [];

  bookingForm = {
    trainer_id: '',
    vehicle_id: '',
    phone: '',
    notes: ''
  };

  constructor(
    private slotService: SlotService,
    private trainerService: TrainerService,
    public authService: AuthService,
    private apiService: ApiService
  ) {}

  // Normalize date string to YYYY-MM-DD format
  normalizeDate(dateStr: string | null | undefined): string {
    if (!dateStr) {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse and convert to YYYY-MM-DD
    try {
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
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  async ngOnInit() {
    // Note: Google OAuth now redirects to /profile with httpOnly cookie, not /booking
    // This code handles error redirects from OAuth failures
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
      this.errorMessage = 'Authentication failed. Please try again.';
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const today = new Date();
    this.selectedDate = this.normalizeDate(today.toISOString().split('T')[0]);
    await this.loadSlots();
    await this.loadTrainers();
    await this.loadVehicles();
    this.startAutoRefresh();
    this.subscribeToSlotEvents();
  }

  private async loadUserProfile() {
    try {
      const user = await this.apiService.get<any>('/auth/me');
      if (user) {
        (this.authService as any).userProfileSubject.next(user);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.slotEvents) {
      this.slotEvents.close();
    }
  }

  async loadSlots() {
    this.loading = true;
    this.errorMessage = '';
    try {
      if (this.selectedDate) {
        // Normalize date to YYYY-MM-DD format
        const normalizedDate = this.normalizeDate(this.selectedDate);
        this.selectedDate = normalizedDate;
        
        // Show all slots for the selected date
        const allSlotsForDate = await this.slotService.getSlotsByDate(normalizedDate);
        // Filter only by time for today (hide past times today)
        const today = getToday();
        let filtered = (allSlotsForDate || []);
        
        if (normalizedDate === today) {
          // Filter out past slots for today
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          filtered = filtered.filter(s => {
            const slotMinutes = timeToMinutes(s.start_time);
            return slotMinutes >= currentMinutes;
          });
        }
        
        // Sort slots by start time (numerically using minutes)
        filtered.sort((a, b) => {
          const timeA = timeToMinutes(a.start_time);
          const timeB = timeToMinutes(b.start_time);
          return timeA - timeB;
        });
        
        this.slots = filtered;
        
        // Optional info: count unassigned for visibility
        if (filtered.length > 0) {
          const unassignedCount = filtered.filter(s => !s.trainer_id || !s.trainer).length;
          if (unassignedCount > 0) {
            console.info(`Showing ${unassignedCount} unassigned slots on ${normalizedDate}`);
          }
        }
      } else {
        this.slots = [];
      }
    } catch (error) {
      console.error('Failed to load slots:', error);
      this.errorMessage = 'Failed to load slots. Please try again.';
      this.slots = [];
    } finally {
      this.loading = false;
    }
  }

  subscribeToSlotEvents() {
    try {
      const url = `${environment.apiUrl}/events`;
      this.slotEvents = new EventSource(url);
      this.slotEvents.onmessage = async (ev) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          const evt = payload.event as string;
          const data = payload.data || {};
          if (!evt || !evt.startsWith('slot.')) return;

          // If the change affects the currently selected date, reload
          const affectedDate = data.slot_date || extractDateFromDateTime(data.start_time) || payload.date;
          if (!affectedDate || affectedDate === this.selectedDate) {
            await this.loadSlots();
          }
        } catch (_) {}
      };
    } catch (e) {
      // SSE may fail on some environments; fallback to polling already enabled
      console.warn('SSE unavailable, using polling only');
    }
  }

  async loadTrainers() {
    try {
      this.trainers = await this.trainerService.getOnDutyTrainers();
      if (this.trainers.length === 0) {
        console.warn('No active trainers available');
      }
    } catch (error) {
      console.error('Failed to load trainers:', error);
      this.trainers = [];
      this.errorMessage = 'Failed to load trainers. Please refresh the page.';
    }
  }

  async loadVehicles() {
    try {
      const response = await this.apiService.get<any[]>('/vehicles');
      this.vehicles = response;
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    }
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadSlots();
    }, 10000);
  }

  async onDateChange() {
    // Normalize date when it changes
    this.selectedDate = this.normalizeDate(this.selectedDate);
    await this.loadSlots();
  }

  async selectSlot(slot: Slot) {
    if (this.isSlotDisabled(slot) || this.isSlotFull(slot) || this.isSlotBooked(slot)) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.showLoginPrompt = true;
      return;
    }

    // Reload trainers to ensure we have the latest data
    await this.loadTrainers();

    // Load user profile to pre-populate phone number if available
    try {
      const user = await this.apiService.get<any>('/auth/me');
      if (user && user.phone && !user.phone.startsWith('GOOGLE_')) {
        this.bookingForm.phone = user.phone;
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }

    this.selectedSlot = slot;
    this.bookingForm.trainer_id = slot.trainer_id || '';
    this.showBookingModal = true;
    this.captchaVerified = false;
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      this.errorMessage = 'Failed to sign in';
    }
  }

  closeBookingModal() {
    this.showBookingModal = false;
    this.selectedSlot = null;
    this.captchaVerified = false;
    this.resetForm();
  }

  onCaptchaVerified(verified: boolean) {
    this.captchaVerified = verified;
  }

  async confirmBooking() {
    if (!this.selectedSlot || !this.captchaVerified) return;

    if (!this.bookingForm.trainer_id || !this.bookingForm.vehicle_id) {
      this.errorMessage = 'Please select both trainer and vehicle';
      return;
    }

    if (!this.bookingForm.phone || !/^[0-9]{10}$/.test(this.bookingForm.phone)) {
      this.errorMessage = 'Please enter a valid 10-digit mobile number';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      await this.apiService.post('/bookings', {
        slot_id: this.selectedSlot.id,
        trainer_id: this.bookingForm.trainer_id,
        vehicle_id: this.bookingForm.vehicle_id,
        phone: this.bookingForm.phone,
        notes: this.bookingForm.notes
      });

      this.closeBookingModal();
      this.showConfirmation = true;

      setTimeout(() => {
        this.showConfirmation = false;
      }, 4000);

      await this.loadSlots();
    } catch (error: any) {
      this.errorMessage = error.error?.error || error.message || 'Failed to create booking';
    } finally {
      this.loading = false;
    }
  }

  resetForm() {
    this.bookingForm = {
      trainer_id: '',
      vehicle_id: '',
      phone: '',
      notes: ''
    };
    this.errorMessage = '';
  }

  getMinDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  formatTime(datetime: string): string {
    return formatTimeToAMPM(datetime);
  }

  isSlotAvailable(slot: Slot): boolean {
    return slot.status === 'available' && slot.booked_count < slot.capacity;
  }

  isSlotBooked(slot: Slot): boolean {
    return slot.booked_count > 0 && slot.booked_count < slot.capacity;
  }

  isSlotFull(slot: Slot): boolean {
    return slot.booked_count >= slot.capacity || slot.status === 'full';
  }

  isSlotDisabled(slot: Slot): boolean {
    return slot.status === 'disabled' || slot.status === 'cancelled';
  }

  hasNoTrainer(slot: Slot): boolean {
    return !slot.trainer_id || !slot.trainer;
  }

  getTrainerName(slot: Slot): string {
    return slot.trainer?.profile?.full_name || 'Unassigned';
  }

  // PHASE 3: Use centralized date utilities
  changeDate(days: number) {
    if (!this.selectedDate) {
      this.selectedDate = getToday();
      this.onDateChange();
      return;
    }
    
    const normalizedDate = normalizeDate(this.selectedDate);
    if (!normalizedDate) {
      this.selectedDate = getToday();
      this.onDateChange();
      return;
    }
    
    // Add/subtract days using utility
    const newDate = addDays(normalizedDate, days);
    const today = getToday();
    
    // Prevent navigating to past dates
    if (newDate < today) {
      this.selectedDate = today;
    } else {
      this.selectedDate = newDate;
    }
    this.onDateChange();
  }

  isPrevDisabled(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(this.selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() <= today.getTime();
  }
}
