import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SlotService, Slot } from '../../services/slot.service';
import { AuthService } from '../../services/auth.service';
import { CaptchaComponent } from '../../components/captcha/captcha.component';
import { Subscription } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  private supabase: SupabaseClient;

  bookingForm = {
    notes: ''
  };

  constructor(
    private slotService: SlotService,
    public authService: AuthService
  ) {
    const supabaseUrl = (window as any).ENV?.VITE_SUPABASE_URL || 'https://yvcdcmthcognzodgfvjq.supabase.co';
    const supabaseKey = (window as any).ENV?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y2RjbXRoY29nbnpvZGdmdmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODY0MDMsImV4cCI6MjA3NzY2MjQwM30.Z2uJXAvEudnV6IvHPJxi-zJ5uWOv8R5xXV63_AsiTeo';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

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
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await this.supabase
        .from('bookings')
        .insert({
          user_id: user.user.id,
          slot_id: this.selectedSlot.id,
          trainer_id: this.selectedSlot.trainer_id,
          notes: this.bookingForm.notes,
          status: 'pending'
        });

      if (error) throw error;

      await this.supabase
        .from('slots')
        .update({ booked_count: this.selectedSlot.booked_count + 1 })
        .eq('id', this.selectedSlot.id);

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
