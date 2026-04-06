import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface SlotWithTrainer {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed' | 'disabled';
  trainer?: {
    id: string;
    user_id: string;
    bio: string;
    experience_years: number;
    rating: number;
    is_active: boolean;
    profile?: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

export interface BookingWithDetails {
  id: string;
  user_id: string;
  slot_id: string;
  trainer_id: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  created_at: string;
  slot?: SlotWithTrainer;
  user?: {
    full_name: string;
    email: string;
    phone: string | null;
  };
  trainer?: {
    full_name: string;
    rating: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private slotsSubject = new BehaviorSubject<SlotWithTrainer[]>([]);
  private bookingsSubject = new BehaviorSubject<BookingWithDetails[]>([]);

  slots$: Observable<SlotWithTrainer[]> = this.slotsSubject.asObservable();
  bookings$: Observable<BookingWithDetails[]> = this.bookingsSubject.asObservable();

  constructor(
    private http: HttpService,
    private authService: AuthService
  ) {}

  async getSlotsByDate(date: string): Promise<void> {
    try {
      const slots = await firstValueFrom(this.http.get<SlotWithTrainer[]>(`/slots?date=${date}`));
      this.slotsSubject.next(slots || []);
    } catch (error) {
      throw error;
    }
  }

  async getAllSlots(): Promise<void> {
    try {
      const slots = await firstValueFrom(this.http.get<SlotWithTrainer[]>('/slots'));
      this.slotsSubject.next(slots || []);
    } catch (error) {
      throw error;
    }
  }

  async getMyBookings(): Promise<void> {
    try {
      const bookings = await firstValueFrom(this.http.get<BookingWithDetails[]>('/bookings/my-bookings'));
      this.bookingsSubject.next(bookings || []);
    } catch (error) {
      throw error;
    }
  }

  async createBooking(
    slotId: string,
    notes: string,
    phone?: string,
    trainerId?: string
  ): Promise<BookingWithDetails> {
    try {
      const body: Record<string, string> = {
        slot_id: slotId,
        notes: notes || ''
      };
      if (phone?.trim()) {
        body.phone = phone.trim();
      }
      if (trainerId?.trim()) {
        body.trainer_id = trainerId.trim();
      }
      const booking = await firstValueFrom(this.http.post<BookingWithDetails>('/bookings', body));

      if (!booking) {
        throw new Error('Failed to create booking');
      }

      return booking;
    } catch (error) {
      throw error;
    }
  }

  async cancelBooking(bookingId: string, reason: string): Promise<void> {
    try {
      await firstValueFrom(this.http.put(`/bookings/${bookingId}/cancel`, { cancellation_reason: reason }));
    } catch (error) {
      throw error;
    }
  }

  async loadSlots(): Promise<SlotWithTrainer[]> {
    try {
      const slots = await firstValueFrom(this.http.get<SlotWithTrainer[]>('/slots'));
      this.slotsSubject.next(slots || []);
      return slots || [];
    } catch {
      return [];
    }
  }

  async getActiveTrainers(): Promise<any[]> {
    try {
      const trainers = await firstValueFrom(this.http.get<any[]>('/trainers/active'));
      return trainers || [];
    } catch {
      return [];
    }
  }
}
