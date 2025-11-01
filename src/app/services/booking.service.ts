import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SlotWithTrainer {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed';
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
  slots$: Observable<SlotWithTrainer[]> = this.slotsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService
  ) {
    this.setupRealtimeSubscription();
  }

  private setupRealtimeSubscription() {
    this.supabase.client
      .channel('slots_channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'slots' },
        () => {
          this.loadSlots();
        }
      )
      .subscribe();

    this.supabase.client
      .channel('bookings_channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          this.loadSlots();
        }
      )
      .subscribe();
  }

  async loadSlots(startDate?: string, endDate?: string) {
    let query = this.supabase.client
      .from('slots')
      .select(`
        *,
        trainer:trainers!slots_trainer_id_fkey (
          id,
          user_id,
          bio,
          experience_years,
          rating,
          is_active,
          profile:profiles!trainers_user_id_fkey (
            full_name,
            avatar_url
          )
        )
      `)
      .neq('status', 'cancelled');

    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading slots:', error);
      throw error;
    }

    this.slotsSubject.next(data as any || []);
    return data as any as SlotWithTrainer[];
  }

  async getSlotsByDate(date: string): Promise<SlotWithTrainer[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.loadSlots(startOfDay.toISOString(), endOfDay.toISOString());
  }

  async getActiveTrainers() {
    const { data, error } = await this.supabase.client
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey (
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createBooking(slotId: string, trainerId: string, notes: string = '') {
    const user = this.auth.getUserProfile();
    if (!user) throw new Error('User must be authenticated');

    const { data: slot, error: slotError } = await this.supabase.client
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single();

    if (slotError) throw slotError;
    if (!slot) throw new Error('Slot not found');

    const typedSlot = slot as any;
    if (typedSlot.booked_count >= typedSlot.capacity) {
      throw new Error('Slot is already full');
    }

    const { data: existingBooking } = await this.supabase.client
      .from('bookings')
      .select('id')
      .eq('slot_id', slotId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle();

    if (existingBooking) {
      throw new Error('You already have a booking for this slot');
    }

    const { data: booking, error: bookingError } = await (this.supabase.client
      .from('bookings')
      .insert({
        user_id: user.id,
        slot_id: slotId,
        trainer_id: trainerId,
        status: 'pending',
        notes
      } as any)
      .select()
      .single() as any);

    if (bookingError) throw bookingError;

    const newBookedCount = typedSlot.booked_count + 1;
    const newStatus = newBookedCount >= typedSlot.capacity ? 'full' : 'available';

    await (this.supabase.client
      .from('slots')
      .update({
        booked_count: newBookedCount,
        status: newStatus
      } as any)
      .eq('id', slotId) as any);

    return booking;
  }

  async getUserBookings(userId?: string) {
    const targetUserId = userId || this.auth.getUserProfile()?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await this.supabase.client
      .from('bookings')
      .select(`
        *,
        slot:slots!bookings_slot_id_fkey (*),
        trainer:trainers!bookings_trainer_id_fkey (
          *,
          profile:profiles!trainers_user_id_fkey (full_name, avatar_url)
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as any as BookingWithDetails[];
  }

  async cancelBooking(bookingId: string, reason?: string) {
    const user = this.auth.getUserProfile();
    if (!user) throw new Error('User must be authenticated');

    const { data: booking, error: fetchError } = await this.supabase.client
      .from('bookings')
      .select('*, slot:slots!bookings_slot_id_fkey(*)')
      .eq('id', bookingId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await (this.supabase.client
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || 'Cancelled by user'
      } as any)
      .eq('id', bookingId) as any);

    if (error) throw error;

    const slot = (booking as any).slot;
    if (slot && slot.booked_count > 0) {
      await (this.supabase.client
        .from('slots')
        .update({
          booked_count: slot.booked_count - 1,
          status: 'available'
        } as any)
        .eq('id', slot.id) as any);
    }
  }
}
