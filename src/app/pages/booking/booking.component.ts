import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { environment } from '../../../environments/environment';
import { normalizeDate, addDays, getKolkataToday, getKolkataCurrentMinutes, formatTimeToAMPM, timeToMinutes, extractTime, extractDateFromDateTime, isPastDateTime } from '../../utils/date.utils';
import { Subscription } from 'rxjs';
import {
  getVehicleCategoryOptions,
  getLiveSlotCapacity,
  getTotalAvailableSeats,
  slotHasVehicleAvailability,
  VehicleCategoryOption
} from '../../utils/vehicle.utils';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

const FEW_SLOTS_THRESHOLD = 2;

export interface ActiveBooking {
  id: string;
  slot_id: string;
  trainer_id: string;
  vehicle_id: string;
  start_time: string;
  end_time?: string;
  slot_date?: string;
  formatted_slot_time?: string;
  trainer_name?: string;
  vehicle_name?: string;
  vehicle_type?: string;
  status: string;
}

interface BookingConfirmationDetails {
  date: string;
  time: string;
  vehicle: string;
}

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
  activeBooking: ActiveBooking | null = null;
  activeBookingLoading = false;
  confirmationDetails: BookingConfirmationDetails | null = null;
  private authSubscription?: Subscription;
  existingBooking: {
    id: string;
    trainer_id: string;
    vehicle_id: string;
    trainer_name?: string;
    vehicle_name?: string;
  } | null = null;
  updateForm = { vehicleId: '' };
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
  vehicleOptions: VehicleCategoryOption[] = [];
  selectedVehicleId = '';

  bookingForm = {
    phone: '',
    notes: ''
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

    this.selectedDate = getKolkataToday();
    await this.loadSlots(false);
    if (this.slots.length === 0) {
      for (let i = 1; i <= 7; i++) {
        this.selectedDate = addDays(getKolkataToday(), i);
        await this.loadSlots(true);
        if (this.slots.length > 0) break;
      }
    }
    this.startAutoRefresh();
    this.subscribeToSlotEvents();
    this.authSubscription = this.authService.userProfile$.subscribe((user) => {
      if (user) {
        void this.loadActiveBooking();
      } else {
        this.activeBooking = null;
      }
    });
    if (this.authService.isAuthenticated()) {
      await this.loadActiveBooking();
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.slotEvents) {
      this.slotEvents.close();
    }
    this.authSubscription?.unsubscribe();
  }

  async loadActiveBooking(): Promise<void> {
    if (!this.authService.isAuthenticated() || !this.selectedDate) {
      this.activeBooking = null;
      return;
    }
    const viewDate = this.normalizeDate(this.selectedDate);
    this.activeBookingLoading = true;
    try {
      const raw = (await firstValueFrom(this.apiService.getMyBookings())) as any[];
      const onSelectedDate = (raw || []).filter((b: any) => {
        const start = b.start_time || b.slot_time || b.booking_datetime;
        const bookingDate =
          extractDateFromDateTime(b.slot_date) ||
          extractDateFromDateTime(start);
        return (
          b.status !== 'cancelled' &&
          b.status !== 'completed' &&
          start &&
          !isPastDateTime(start) &&
          bookingDate === viewDate
        );
      });
      if (onSelectedDate.length === 0) {
        this.activeBooking = null;
        return;
      }
      const b = onSelectedDate[0];
      this.activeBooking = {
        id: b.id,
        slot_id: b.slot_id,
        trainer_id: b.trainer_id,
        vehicle_id: b.vehicle_id,
        start_time: b.start_time || b.slot_time || b.booking_datetime,
        end_time: b.end_time,
        slot_date:
          extractDateFromDateTime(b.slot_date) ||
          extractDateFromDateTime(b.start_time || b.slot_time || b.booking_datetime) ||
          undefined,
        formatted_slot_time: b.formatted_slot_time,
        trainer_name: b.trainer_name,
        vehicle_name: b.vehicle_name,
        vehicle_type: b.vehicle_type,
        status: b.status
      };
    } catch {
      /* keep previous activeBooking on transient errors */
    } finally {
      this.activeBookingLoading = false;
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
        const today = getKolkataToday();
        let filtered = (allSlotsForDate || []);

        if (normalizedDate === today) {
          const currentMinutes = getKolkataCurrentMinutes();
          filtered = filtered.filter((s) => timeToMinutes(s.start_time) >= currentMinutes);
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
            await this.loadActiveBooking();
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
    await this.loadActiveBooking();
  }

  /** UI-only click handler — does not change booking validation in selectSlot(). */
  onSlotClick(slot: Slot) {
    if (this.isSlotDisabled(slot)) {
      return;
    }
    if (this.isSlotFullyBookedUI(slot) && !this.isUserBookedSlot(slot)) {
      return;
    }
    void this.selectSlot(slot);
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

    if (this.activeBooking) {
      this.existingBooking = this.mapActiveToExisting(this.activeBooking);
      this.showOwnBookingPopup = true;
      return;
    }

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
    this.openVehicleSelection(slot);
  }

  private openVehicleSelection(slot: Slot): void {
    this.selectedSlot = slot;
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

      const bookedSlot = this.selectedSlot;
      const confirmation = {
        date: this.formatBookingDateFromSlot(bookedSlot!),
        time: this.formatTime(bookedSlot!.start_time),
        vehicle: this.getSelectedVehicleLabel() || this.getVehicleDisplayFromSlot(bookedSlot!)
      };

      await firstValueFrom(
        this.apiService.createBooking(bookedSlot!.id, {
          phone: this.bookingForm.phone.trim(),
          notes: (this.bookingForm.notes || '').trim(),
          vehicle_id: this.selectedVehicleId
        })
      );

      this.closeBookingModal();
      this.showBookingConfirmation(confirmation);

      await this.loadActiveBooking();
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
        await this.loadActiveBooking();
        if (this.activeBooking) {
          this.existingBooking = this.mapActiveToExisting(this.activeBooking);
        }
        this.showOwnBookingPopup = true;
        this.errorMessage = '';
      } else if (code === 'VEHICLE_CAPACITY_FULL') {
        this.errorMessage =
          body?.message ||
          'That vehicle type was just fully booked. Go back and choose another vehicle or slot.';
      } else if (code === 'BOOKING_GAP_48H' || code === 'BOOKING_ADVANCE_REQUIRED' || code === 'WEEKLY_LIMIT_REACHED') {
        this.errorMessage = body?.message || 'This booking is not allowed at the selected time.';
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

  async goToActiveBookingDate(): Promise<void> {
    if (!this.activeBooking?.slot_date) {
      return;
    }
    const date = this.normalizeDate(this.activeBooking.slot_date);
    if (date !== this.selectedDate) {
      this.selectedDate = date;
      await this.loadSlots(false);
    }
  }

  async openUpdateBooking(): Promise<void> {
    const booking = this.existingBooking || (this.activeBooking ? this.mapActiveToExisting(this.activeBooking) : null);
    if (!booking) {
      return;
    }
    if (this.activeBooking) {
      const slot = this.slots.find((s) => s.id === this.activeBooking!.slot_id);
      if (slot) {
        this.selectedSlot = slot;
      }
    }
    if (!this.selectedSlot) {
      return;
    }

    this.existingBooking = booking;
    this.showOwnBookingPopup = false;
    this.updateForm = {
      vehicleId: this.existingBooking.vehicle_id
    };
    this.vehicleOptions = getVehicleCategoryOptions(this.selectedSlot.vehicle_capacities);
    this.errorMessage = '';
    this.showUpdateBookingModal = true;
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
    if (!this.updateForm.vehicleId) {
      this.errorMessage = 'Please select a vehicle.';
      return;
    }

    this.updateInFlight = true;
    this.errorMessage = '';

    try {
      await firstValueFrom(
        this.apiService.updateBooking(this.existingBooking.id, this.updateForm.vehicleId)
      );
      const updateSlot = this.selectedSlot;
      const vehicleLabel =
        this.vehicleOptions.find((v) => v.vehicle_id === this.updateForm.vehicleId)?.label ||
        this.getVehicleDisplay(this.activeBooking || this.existingBooking);
      const confirmation = {
        date: this.activeBooking
          ? this.formatBookingDate(this.activeBooking)
          : updateSlot
            ? this.formatBookingDateFromSlot(updateSlot)
            : '',
        time: updateSlot
          ? this.formatTime(updateSlot.start_time)
          : this.formatBookingTime(this.activeBooking),
        vehicle: vehicleLabel
      };
      this.closeUpdateBookingModal();
      this.showBookingConfirmation(confirmation);
      await this.loadActiveBooking();
      await this.loadSlots(false);
    } catch (error: any) {
      const body = error?.error;
      const code = body?.errorCode;
      if (code === 'VEHICLE_CAPACITY_FULL') {
        this.errorMessage = body?.message || 'That vehicle is fully booked for this slot.';
      } else if (code === 'BOOKING_GAP_48H' || code === 'BOOKING_ADVANCE_REQUIRED' || code === 'WEEKLY_LIMIT_REACHED') {
        this.errorMessage = body?.message || 'This booking update is not allowed at the selected time.';
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
      this.selectedDate = getKolkataToday();
      this.onDateChange();
      return;
    }
    
    const normalizedDate = normalizeDate(this.selectedDate);
    if (!normalizedDate) {
      this.selectedDate = getKolkataToday();
      this.onDateChange();
      return;
    }
    
    // Add/subtract days using utility
    const newDate = addDays(normalizedDate, days);
    const today = getKolkataToday();
    
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

  /** Display capacity from API live_capacity or computed live total. */
  getSlotLiveCapacity(slot: Slot): number {
    if (slot.live_capacity != null && Number.isFinite(Number(slot.live_capacity))) {
      return Math.max(0, Number(slot.live_capacity));
    }
    return getLiveSlotCapacity(slot);
  }

  /** UI display: availableSeats = live_capacity - booked_count */
  getDisplayAvailableSeats(slot: Slot): number {
    const liveCap = this.getSlotLiveCapacity(slot);
    const booked = Number(slot.booked_count) || 0;
    return Math.max(0, liveCap - booked);
  }

  isSlotFullyBookedUI(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isUserBookedSlot(slot)) {
      return false;
    }
    return this.getDisplayAvailableSeats(slot) <= 0;
  }

  isSlotLimitedUI(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isUserBookedSlot(slot) || this.isSlotFullyBookedUI(slot)) {
      return false;
    }
    const available = this.getDisplayAvailableSeats(slot);
    return available >= 1 && available <= FEW_SLOTS_THRESHOLD;
  }

  isSlotAvailableUI(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isUserBookedSlot(slot) || this.isSlotFullyBookedUI(slot)) {
      return false;
    }
    return this.getDisplayAvailableSeats(slot) > FEW_SLOTS_THRESHOLD;
  }

  getSlotCapacity(slot: Slot): number {
    return getLiveSlotCapacity(slot);
  }

  getAvailableCount(slot: Slot): number {
    return this.getRemainingSeats(slot);
  }

  isUserBookedSlot(slot: Slot): boolean {
    return !!this.activeBooking && this.activeBooking.slot_id === slot.id;
  }

  isFewSlotsLeft(slot: Slot): boolean {
    if (this.isSlotDisabled(slot) || this.isSlotFull(slot) || this.isUserBookedSlot(slot)) {
      return false;
    }
    const available = this.getAvailableCount(slot);
    return available > 0 && available <= FEW_SLOTS_THRESHOLD;
  }

  getSlotStatusLabel(slot: Slot): string {
    if (this.isSlotDisabled(slot)) {
      return 'DISABLED';
    }
    if (this.isUserBookedSlot(slot)) {
      return 'YOUR BOOKING';
    }
    if (this.isSlotFullyBookedUI(slot)) {
      return 'FULLY BOOKED';
    }
    if (this.isSlotLimitedUI(slot)) {
      return 'Limited Availability';
    }
    return 'Available';
  }

  getCapacityLabel(slot: Slot): string {
    const total = this.getSlotLiveCapacity(slot);
    const available = this.getDisplayAvailableSeats(slot);
    const booked = Number(slot.booked_count) || 0;
    if (this.isUserBookedSlot(slot)) {
      return 'Your booking';
    }
    if (this.isSlotFullyBookedUI(slot)) {
      return `0/${total} Available · ${booked}/${total} booked`;
    }
    return `${available}/${total} · ${booked}/${total} booked`;
  }

  getSameDateBookingMessage(): string {
    const booking = this.getDisplayBooking();
    if (!booking) {
      return 'You already have a booking on this date.';
    }
    return `You already have a booking on ${this.formatBookingDateShort(booking)} at ${this.formatBookingTime(booking)}.`;
  }

  formatBookingDateShort(booking: ActiveBooking | { slot_date?: string; start_time?: string } | null): string {
    if (!booking) {
      return '';
    }
    const dateStr =
      extractDateFromDateTime(booking.slot_date) ||
      extractDateFromDateTime((booking as ActiveBooking).start_time) ||
      normalizeDate(booking.slot_date) ||
      normalizeDate((booking as ActiveBooking).start_time);
    if (!dateStr) {
      return '';
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) {
      return '';
    }
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${d} ${months[m - 1]} ${y}`;
  }

  formatBookingDate(booking: ActiveBooking | { slot_date?: string; start_time?: string; formatted_slot_time?: string } | null): string {
    if (!booking) {
      return '';
    }

    const dateStr =
      extractDateFromDateTime(booking.slot_date) ||
      extractDateFromDateTime((booking as ActiveBooking).start_time) ||
      normalizeDate(booking.slot_date) ||
      normalizeDate((booking as ActiveBooking).start_time);

    if (!dateStr) {
      if (booking.formatted_slot_time) {
        const parts = booking.formatted_slot_time.split(',');
        if (parts.length >= 2) {
          return `${parts[0].trim()}, ${parts[1].trim()}`;
        }
      }
      return '';
    }

    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
      return '';
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dateObj.getTime())) {
      return '';
    }
    return `${days[dateObj.getUTCDay()]}, ${months[m - 1]} ${d}, ${y}`;
  }

  formatBookingDateFromSlot(slot: Slot): string {
    const dateStr = extractDateFromDateTime(slot.start_time) || this.selectedDate;
    return this.formatBookingDate({ slot_date: dateStr, start_time: slot.start_time });
  }

  formatBookingTime(booking: ActiveBooking | null): string {
    if (!booking) {
      return '';
    }
    if (booking.formatted_slot_time) {
      const parts = booking.formatted_slot_time.split(',');
      return parts[parts.length - 1]?.trim() || booking.formatted_slot_time;
    }
    return booking.start_time ? this.formatTime(booking.start_time) : '';
  }

  getVehicleDisplay(booking: ActiveBooking | typeof this.existingBooking | null): string {
    if (!booking) {
      return '';
    }
    const name = 'vehicle_name' in booking ? booking.vehicle_name : '';
    const type = 'vehicle_type' in booking ? booking.vehicle_type : '';
    if (name && type) {
      return `${name} (${type})`;
    }
    return name || type || 'Not specified';
  }

  getVehicleDisplayFromSlot(slot: Slot): string {
    return this.getSelectedVehicleLabel();
  }

  getDisplayBooking(): ActiveBooking | null {
    if (this.activeBooking) {
      return this.activeBooking;
    }
    if (this.existingBooking && this.selectedSlot) {
      return {
        id: this.existingBooking.id,
        slot_id: this.selectedSlot.id,
        trainer_id: this.existingBooking.trainer_id,
        vehicle_id: this.existingBooking.vehicle_id,
        start_time: this.selectedSlot.start_time,
        end_time: this.selectedSlot.end_time,
        slot_date: extractDateFromDateTime(this.selectedSlot.start_time) || this.selectedDate,
        trainer_name: this.existingBooking.trainer_name,
        vehicle_name: this.existingBooking.vehicle_name,
        status: 'confirmed'
      };
    }
    return null;
  }

  private mapActiveToExisting(booking: ActiveBooking): NonNullable<typeof this.existingBooking> {
    return {
      id: booking.id,
      trainer_id: booking.trainer_id,
      vehicle_id: booking.vehicle_id,
      trainer_name: booking.trainer_name,
      vehicle_name: booking.vehicle_name
    };
  }

  private showBookingConfirmation(details: BookingConfirmationDetails): void {
    this.confirmationDetails = details;
    this.showConfirmation = true;
    setTimeout(() => {
      this.showConfirmation = false;
      this.confirmationDetails = null;
    }, 6000);
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
