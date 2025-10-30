import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService, SlotWithTrainer } from '../../services/booking.service';
import { AuthService } from '../../services/auth.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, CaptchaComponent],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit, OnDestroy {
  slots: SlotWithTrainer[] = [];
  selectedDate: string = '';
  selectedSlot: SlotWithTrainer | null = null;
  showBookingModal = false;
  showConfirmation = false;
  showLoginPrompt = false;
  captchaVerified = false;
  loading = false;
  errorMessage = '';
  private slotsSubscription?: Subscription;

  bookingForm = {
    notes: ''
  };

  constructor(
    public bookingService: BookingService,
    public authService: AuthService
  ) {}

  async ngOnInit() {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    await this.loadSlots();

    this.slotsSubscription = this.bookingService.slots$.subscribe(slots => {
      this.slots = slots.filter(slot => {
        const slotDate = new Date(slot.start_time).toISOString().split('T')[0];
        return slotDate === this.selectedDate;
      });
    });
  }

  ngOnDestroy() {
    this.slotsSubscription?.unsubscribe();
  }

  async loadSlots() {
    this.loading = true;
    try {
      await this.bookingService.getSlotsByDate(this.selectedDate);
    } catch (error) {
      this.errorMessage = 'Failed to load slots';
    } finally {
      this.loading = false;
    }
  }

  async onDateChange() {
    await this.loadSlots();
  }

  selectSlot(slot: SlotWithTrainer) {
    if (!this.authService.isAuthenticated()) {
      this.showLoginPrompt = true;
      return;
    }

    if (slot.status === 'available' && slot.booked_count < slot.capacity) {
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
    if (!this.selectedSlot || !this.captchaVerified) return;

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.bookingService.createBooking(
        this.selectedSlot.id,
        this.selectedSlot.trainer_id,
        this.bookingForm.notes
      );

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

  isSlotAvailable(slot: SlotWithTrainer): boolean {
    return slot.status === 'available' && slot.booked_count < slot.capacity;
  }
}
