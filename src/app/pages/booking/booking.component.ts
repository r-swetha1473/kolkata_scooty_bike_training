import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { TrainerService, Trainer } from '../../services/trainer.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';

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
  trainers: Trainer[] = [];
  vehicles: any[] = [];

  bookingForm = {
    trainer_id: '',
    vehicle_id: '',
    notes: ''
  };

  constructor(
    private slotService: SlotService,
    private trainerService: TrainerService,
    public authService: AuthService,
    private apiService: ApiService
  ) {}

  async ngOnInit() {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    await this.loadSlots();
    await this.loadTrainers();
    await this.loadVehicles();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadSlots() {
    this.loading = true;
    this.errorMessage = '';
    try {
      if (this.selectedDate) {
        const slots = await this.slotService.getSlotsByDate(this.selectedDate);
        this.slots = slots;
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

  async loadTrainers() {
    try {
      this.trainers = await this.trainerService.getOnDutyTrainers();
    } catch (error) {
      console.error('Failed to load trainers:', error);
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
    await this.loadSlots();
  }

  selectSlot(slot: Slot) {
    if (slot.status === 'disabled' || slot.status === 'cancelled' || slot.booked_count >= slot.capacity) {
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.showLoginPrompt = true;
      return;
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
      notes: ''
    };
    this.errorMessage = '';
  }

  getMinDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  changeDate(days: number) {
    const current = new Date(this.selectedDate);
    current.setDate(current.getDate() + days);
    this.selectedDate = current.toISOString().split('T')[0];
    this.onDateChange();
  }
}
