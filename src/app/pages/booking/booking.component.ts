import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
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

  bookingForm = {
    notes: ''
  };

  constructor(
    private slotService: SlotService,
    public authService: AuthService,
    private apiService: ApiService
  ) {}

  async ngOnInit() {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    await this.loadSlots();
  }

  ngOnDestroy() {}

  async loadSlots() {
    this.loading = true;
    this.errorMessage = '';
    try {
      // Get all slots for the date, not just available ones
      // This allows showing slots that need trainer assignment
      if (this.selectedDate) {
        const slots = await this.slotService.getSlotsByDate(this.selectedDate);
        // Filter to show only slots with trainers (for booking) or show all with status indicators
        this.slots = slots.filter(slot => slot.trainer_id && slot.status === 'available');
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

  async onDateChange() {
    await this.loadSlots();
  }

  selectSlot(slot: Slot) {
    if (!this.authService.isAuthenticated()) {
      this.showLoginPrompt = true;
      return;
    }

    if (slot.status === 'available' && slot.booked_count < slot.capacity && slot.trainer_id) {
      this.selectedSlot = slot;
      this.showBookingModal = true;
      this.captchaVerified = false;
    }
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
    if (!this.selectedSlot || !this.captchaVerified || !this.selectedSlot.trainer_id) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      await this.apiService.createBooking(this.selectedSlot.id, this.bookingForm.notes);

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
    return slot.status === 'available' && slot.booked_count < slot.capacity && !!slot.trainer_id;
  }

  isSlotBooked(slot: Slot): boolean {
    return slot.booked_count >= slot.capacity || slot.status === 'full' || slot.status === 'completed';
  }

  isSlotFull(slot: Slot): boolean {
    return slot.booked_count >= slot.capacity;
  }

  hasNoTrainer(slot: Slot): boolean {
    return !slot.trainer_id || !slot.trainer;
  }
}
