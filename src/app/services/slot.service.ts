import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Slot {
  id: string;
  trainer_id?: string;
  start_time: string;
  end_time: string;
  slot_date: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed';
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  trainer?: {
    id: string;
    profile: {
      full_name: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SlotService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = (window as any).ENV?.VITE_SUPABASE_URL || 'https://yvcdcmthcognzodgfvjq.supabase.co';
    const supabaseKey = (window as any).ENV?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y2RjbXRoY29nbnpvZGdmdmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODY0MDMsImV4cCI6MjA3NzY2MjQwM30.Z2uJXAvEudnV6IvHPJxi-zJ5uWOv8R5xXV63_AsiTeo';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async generateDailySlots(date?: string): Promise<any> {
    const apiUrl = `https://yvcdcmthcognzodgfvjq.supabase.co/functions/v1/generate-daily-slots`;
    const headers = {
      'Content-Type': 'application/json',
    };

    const body = date ? JSON.stringify({ date }) : JSON.stringify({});

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body,
    });

    return await response.json();
  }

  async getSlotsByDate(date: string): Promise<Slot[]> {
    const { data, error } = await this.supabase
      .from('slots')
      .select(`
        *,
        trainer:trainers(
          id,
          profile:profiles!trainers_user_id_fkey(
            full_name
          )
        )
      `)
      .eq('slot_date', date)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getSlotsByDateRange(startDate: string, endDate: string): Promise<Slot[]> {
    const { data, error } = await this.supabase
      .from('slots')
      .select(`
        *,
        trainer:trainers(
          id,
          profile:profiles!trainers_user_id_fkey(
            full_name
          )
        )
      `)
      .gte('slot_date', startDate)
      .lte('slot_date', endDate)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getAvailableSlots(date?: string): Promise<Slot[]> {
    let query = this.supabase
      .from('slots')
      .select(`
        *,
        trainer:trainers(
          id,
          profile:profiles!trainers_user_id_fkey(
            full_name
          )
        )
      `)
      .eq('status', 'available')
      .neq('trainer_id', null);

    if (date) {
      query = query.eq('slot_date', date);
    }

    const { data, error } = await query.order('start_time', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getSlotById(id: string): Promise<Slot | null> {
    const { data, error } = await this.supabase
      .from('slots')
      .select(`
        *,
        trainer:trainers(
          id,
          profile:profiles!trainers_user_id_fkey(
            full_name
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createSlot(slot: Partial<Slot>): Promise<Slot> {
    const { data, error } = await this.supabase
      .from('slots')
      .insert(slot)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSlot(id: string, updates: Partial<Slot>): Promise<Slot> {
    const { data, error } = await this.supabase
      .from('slots')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async assignTrainer(slotId: string, trainerId: string): Promise<Slot> {
    return this.updateSlot(slotId, { trainer_id: trainerId });
  }

  async unassignTrainer(slotId: string): Promise<Slot> {
    return this.updateSlot(slotId, { trainer_id: null });
  }

  async deleteSlot(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('slots')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteSlotsByDate(date: string): Promise<void> {
    const { error } = await this.supabase
      .from('slots')
      .delete()
      .eq('slot_date', date);

    if (error) throw error;
  }
}
