import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { AuthService } from '../../services/auth.service';
import { ApiService, Trainer } from '../../services/api.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { environment } from '../../../environments/environment';
import { normalizeDate, addDays, getToday, formatTimeToAMPM, timeToMinutes, extractTime, extractDateFromDateTime } from '../../utils/date.utils';
import {
  getVehicleCategoryOptions,
  getTotalAvailableSeats,
  slotHasVehicleAvailability,
  VehicleCategoryOption
} from '../../utils/vehicle.utils';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

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
  showVehicleModal = false;
  showBookingModal = false;
  showConfirmation = false;
  showLoginPrompt = false;
  showOwnBookingPopup = false;
  showSlotTakenPopup = false;
  showUpdateBookingModal = false;
  existingBooking: {
    id: string;
    trainer_id: string;
    vehicle_id: string;
    trainer_name?: string;
    vehicle_name?: string;
  } | null = null;
  updateForm = { trainerId: '', vehicleId: '' };
  updateInFlight = false;
  captchaVerified = false;
  loading = false;
  /** True only on initial load / user actions — not background refresh. */
  showLoadingSpinner = false;
  /** Prevents double-submit before Angular disables the button. */
  private bookingInFlight = false;
  errorMessage = '';
  refreshInterval: any;
  slotEvents?: EventSource;
  trainersForSlot: Trainer[] = [];
  trainersLoadError = '';
  trainersLoading = false;

  vehicleOptions: VehicleCategoryOption[] = [];
  selectedVehicleId = '';

  bookingForm = {
    phone: '',
    notes: '',
    trainerId: ''
  };

  constructor(
    private slotService: SlotService,
    public authService: AuthService,
    private apiService: ApiService,
    private router: Router
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
    } catch {
      /* invalid date string */
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
    await this.loadSlots(false);
    this.startAutoRefresh();
    this.subscribeToSlotEvents();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.slotEvents) {
      this.slotEvents.close();
    }
  }

  async loadSlots(silent = true) {
    if (!silent) {
      this.showLoadingSpinner = true;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      if (this.selectedDate) {
        // Normalize date to YYYY-MM-DD format
        const normalizedDate = this.normalizeDate(this.selectedDate);
        this.selectedDate = normalizedDate;
        
        // Show all slots for the selected date
        const allSlotsForDate = await this.slotService.getSlotsByDate(normalizedDate, {
          bookableOnly: true
        });
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
      } else {
        this.slots = [];
      }
    } catch {
      this.errorMessage = 'Failed to load slots. Please try again.';
      this.slots = [];
    } finally {
      this.loading = false;
      if (!silent) {
        this.showLoadingSpinner = false;
      }
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
            await this.loadSlots(true);
          }
        } catch (_) {}
      };
    } catch {
      /* SSE optional; polling still runs */
    }
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadSlots(true);
    }, 90000);
  }

  async onDateChange() {
    this.selectedDate = this.normalizeDate(this.selectedDate);
    await this.loadSlots(false);
  }

  async selectSlot(slot: Slot) {
    if (this.isSlotDisabled(slot)) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      if (this.isSlotFull(slot)) {
        return;
      }
      this.showLoginPrompt = true;
      return;
    }

    this.selectedSlot = slot;

    try {
      const status = await this.apiService.getSlotBookingStatus(slot.id);
      if (status.ownedByMe && status.booking) {
        this.existingBooking = status.booking;
        this.showOwnBookingPopup = true;
        return;
      }
      if (status.ownedByOther || (this.isSlotFull(slot) && !status.ownedByMe)) {
        this.showSlotTakenPopup = true;
        return;
      }
    } catch {
      if (this.isSlotFull(slot)) {
        this.showSlotTakenPopup = true;
        return;
      }
    }

    if (this.isSlotFull(slot)) {
      this.showSlotTakenPopup = true;
      return;
    }
    this.vehicleOptions = getVehicleCategoryOptions(slot.vehicle_capacities);
    this.selectedVehicleId = '';
    this.showVehicleModal = true;
  }

  closeVehicleModal() {
    this.showVehicleModal = false;
    this.selectedSlot = null;
    this.vehicleOptions = [];
    this.selectedVehicleId = '';
  }

  async selectVehicle(option: VehicleCategoryOption) {
    if (!option.available || !option.vehicle_id || !this.selectedSlot) {
      return;
    }

    this.selectedVehicleId = option.vehicle_id;
    this.showVehicleModal = false;

    try {
      const user = await this.apiService.get<any>('/auth/me');
      if (user?.phone && !String(user.phone).startsWith('GOOGLE_')) {
        this.bookingForm.phone = user.phone;
      }
    } catch {
      /* phone stays empty */
    }

    this.showBookingModal = true;
    this.captchaVerified = false;
    this.trainersForSlot = [];
    this.trainersLoadError = '';
    this.bookingForm.trainerId = '';
    this.trainersLoading = true;

    try {
      this.trainersForSlot = await firstValueFrom(
        this.apiService.getAvailableTrainersForSlot(this.selectedSlot.id)
      );
      if (this.trainersForSlot.length === 1) {
        this.bookingForm.trainerId = this.trainersForSlot[0].id;
      }
    } catch {
      this.trainersLoadError = 'Could not load trainers. Please try again.';
    } finally {
      this.trainersLoading = false;
    }
  }

  backToVehicleSelection() {
    this.showBookingModal = false;
    this.captchaVerified = false;
    this.resetForm();
    if (this.selectedSlot) {
      this.vehicleOptions = getVehicleCategoryOptions(this.selectedSlot.vehicle_capacities);
      this.showVehicleModal = true;
    }
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch {
      this.errorMessage = 'Failed to sign in';
    }
  }

  closeBookingModal() {
    this.showBookingModal = false;
    this.showVehicleModal = false;
    this.selectedSlot = null;
    this.selectedVehicleId = '';
    this.vehicleOptions = [];
    this.captchaVerified = false;
    this.resetForm();
  }

  onCaptchaVerified(verified: boolean) {
    this.captchaVerified = verified;
  }

  async confirmBooking() {
    if (this.bookingInFlight || this.loading) {
      return;
    }
    if (!this.selectedSlot || !this.captchaVerified || !this.selectedVehicleId) return;

    if (!this.bookingForm.trainerId) {
      this.errorMessage = 'Please select a trainer.';
      return;
    }

    if (!this.bookingForm.phone || !/^[0-9]{10}$/.test(this.bookingForm.phone)) {
      this.errorMessage = 'Please enter a valid 10-digit mobile number';
      return;
    }

    this.bookingInFlight = true;
    this.loading = true;
    this.errorMessage = '';

    try {
      if (!this.authService.isAuthenticated()) {
        this.errorMessage = 'Please sign in to book.';
        return;
      }

      await firstValueFrom(
        this.apiService.createBooking(this.selectedSlot.id, {
          phone: this.bookingForm.phone.trim(),
          notes: (this.bookingForm.notes || '').trim(),
          trainer_id: this.bookingForm.trainerId.trim(),
          vehicle_id: this.selectedVehicleId
        })
      );

      this.closeBookingModal();
      this.showConfirmation = true;

      setTimeout(() => {
        this.showConfirmation = false;
      }, 4000);

      await this.loadSlots(false);
    } catch (error: any) {
      const status = error?.status;
      const body = error?.error;
      const code = body?.errorCode;

      if (status === 401 || code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
        this.errorMessage = 'Your session expired. Please sign out and sign in again.';
        return;
      }

      if (status === 403 && code === 'INACTIVE_BLOCKED') {
        this.errorMessage = body?.message || 'Your account is inactive. Contact admin.';
        return;
      }

      if (code === 'ACTIVE_BOOKING_EXISTS') {
        this.showOwnBookingPopup = true;
        this.errorMessage = '';
      } else if (code === 'TRAINER_SLOT_TAKEN') {
        this.errorMessage =
          body?.message ||
          'That trainer was just taken for this slot. Choose another trainer and try again.';
      } else if (code === 'VEHICLE_CAPACITY_FULL') {
        this.errorMessage =
          body?.message ||
          'That vehicle type was just fully booked. Go back and choose another vehicle or slot.';
      } else {
        const fromValidation =
          Array.isArray(body?.errors) && body.errors.length
            ? body.errors.map((e: { message?: string }) => e.message).filter(Boolean).join(' ')
            : '';
        this.errorMessage =
          fromValidation ||
          body?.message ||
          body?.error ||
          error?.message ||
          'Failed to create booking. Please try again.';
      }
    } finally {
      this.loading = false;
      this.bookingInFlight = false;
    }
  }

  closeOwnBookingPopup(): void {
    this.showOwnBookingPopup = false;
    this.existingBooking = null;
  }

  closeSlotTakenPopup(): void {
    this.showSlotTakenPopup = false;
    this.selectedSlot = null;
  }

  viewExistingBooking(): void {
    this.closeOwnBookingPopup();
    this.router.navigate(['/my-bookings']);
  }

  async openUpdateBooking(): Promise<void> {
    if (!this.existingBooking || !this.selectedSlot) {
      return;
    }

    this.showOwnBookingPopup = false;
    this.updateForm = {
      trainerId: this.existingBooking.trainer_id,
      vehicleId: this.existingBooking.vehicle_id
    };
    this.vehicleOptions = getVehicleCategoryOptions(this.selectedSlot.vehicle_capacities);
    this.trainersForSlot = [];
    this.trainersLoadError = '';
    this.trainersLoading = true;
    this.errorMessage = '';
    this.showUpdateBookingModal = true;

    try {
      this.trainersForSlot = await firstValueFrom(
        this.apiService.getAvailableTrainersForSlot(this.selectedSlot.id)
      );
    } catch {
      this.trainersLoadError = 'Could not load trainers. Please try again.';
    } finally {
      this.trainersLoading = false;
    }
  }

  closeUpdateBookingModal(): void {
    this.showUpdateBookingModal = false;
    this.updateInFlight = false;
    this.errorMessage = '';
    this.existingBooking = null;
    this.selectedSlot = null;
  }

  async confirmUpdateBooking(): Promise<void> {
    if (this.updateInFlight || !this.existingBooking) {
      return;
    }
    if (!this.updateForm.trainerId || !this.updateForm.vehicleId) {
      this.errorMessage = 'Please select a trainer and vehicle.';
      return;
    }

    this.updateInFlight = true;
    this.errorMessage = '';

    try {
      await firstValueFrom(
        this.apiService.updateBooking(
          this.existingBooking.id,
          this.updateForm.trainerId,
          this.updateForm.vehicleId
        )
      );
      this.closeUpdateBookingModal();
      this.showConfirmation = true;
      setTimeout(() => {
        this.showConfirmation = false;
      }, 4000);
      await this.loadSlots(false);
    } catch (error: any) {
      const body = error?.error;
      const code = body?.errorCode;
      if (code === 'TRAINER_SLOT_TAKEN') {
        this.errorMessage = body?.message || 'That trainer is not available for this slot.';
      } else if (code === 'VEHICLE_CAPACITY_FULL') {
        this.errorMessage = body?.message || 'That vehicle is fully booked for this slot.';
      } else {
        this.errorMessage = body?.message || body?.error || 'Failed to update booking.';
      }
    } finally {
      this.updateInFlight = false;
    }
  }

  resetForm() {
    this.bookingForm = {
      phone: '',
      notes: '',
      trainerId: ''
    };
    this.trainersForSlot = [];
    this.trainersLoadError = '';
    this.trainersLoading = false;
    this.errorMessage = '';
  }

  getMinDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  formatTime(datetime: string): string {
    return formatTimeToAMPM(datetime);
  }

  isSlotAvailable(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isSlotFull(slot)) {
      return false;
    }
    return slotHasVehicleAvailability(slot);
  }

  isSlotPartiallyBooked(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isSlotFull(slot)) {
      return false;
    }
    const booked = Number(slot.booked_count) || 0;
    return booked > 0 && slotHasVehicleAvailability(slot);
  }

  isSlotFull(slot: Slot): boolean {
    if (slot.status === 'full') {
      return true;
    }
    if (this.isSlotDisabled(slot)) {
      return false;
    }
    return !slotHasVehicleAvailability(slot);
  }

  isSlotDisabled(slot: Slot): boolean {
    return slot.status === 'disabled' || slot.status === 'cancelled';
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

  getRemainingSeats(slot: Slot): number {
    return getTotalAvailableSeats(slot);
  }

  getSelectedVehicleLabel(): string {
    if (!this.selectedVehicleId || !this.selectedSlot) {
      return '';
    }
    const options = getVehicleCategoryOptions(this.selectedSlot.vehicle_capacities);
    const match = options.find((o) => o.vehicle_id === this.selectedVehicleId);
    return match?.label || '';
  }
}
