import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { AuthService } from '../../services/auth.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { environment } from '../../../environments/environment';

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
  private apiUrl = environment.apiUrl;

  bookingForm = {
    notes: ''
  };

  constructor(
    private slotService: SlotService,
    public authService: AuthService
  ) {}

  async ngOnInit() {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    await this.loadSlots();
  }

  ngOnDestroy() {}

  async loadSlots() {
    this.loading = true;
    try {
      this.slots = await this.slotService.getAvailableSlots(this.selectedDate);
    } catch (error) {
      this.errorMessage = 'Failed to load slots';
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
      const response = await fetch(`${this.apiUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slot_id: this.selectedSlot.id,
          trainer_id: this.selectedSlot.trainer_id,
          notes: this.bookingForm.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      this.closeBookingModal();
      this.showConfirmation = true;

      setTimeout(() => {
        this.showConfirmation = false;
      }, 4000);

      await this.loadSlots();
    } catch (error: any) {
      this.errorMessage = error.message || 'Failed to create booking';
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
}
