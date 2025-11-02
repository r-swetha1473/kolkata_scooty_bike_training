import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Trainer {
  id: string;
  user_id: string;
  bio: string;
  experience_years: number;
  specialization: string[];
  rating: number;
  total_sessions: number;
  is_active: boolean;
  on_duty: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string;
    email: string;
    phone?: string;
    avatar_url?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TrainerService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = (window as any).ENV?.VITE_SUPABASE_URL || 'https://yvcdcmthcognzodgfvjq.supabase.co';
    const supabaseKey = (window as any).ENV?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y2RjbXRoY29nbnpvZGdmdmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODY0MDMsImV4cCI6MjA3NzY2MjQwM30.Z2uJXAvEudnV6IvHPJxi-zJ5uWOv8R5xXV63_AsiTeo';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getAllTrainers(): Promise<Trainer[]> {
    const { data, error } = await this.supabase
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey(
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActiveTrainers(): Promise<Trainer[]> {
    const { data, error } = await this.supabase
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey(
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getOnDutyTrainers(): Promise<Trainer[]> {
    const { data, error } = await this.supabase
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey(
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .eq('is_active', true)
      .eq('on_duty', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getTrainerById(id: string): Promise<Trainer | null> {
    const { data, error } = await this.supabase
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey(
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createTrainer(trainer: Partial<Trainer>): Promise<Trainer> {
    const { data, error } = await this.supabase
      .from('trainers')
      .insert(trainer)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer> {
    const { data, error } = await this.supabase
      .from('trainers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async toggleOnDuty(id: string, onDuty: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { on_duty: onDuty });
  }

  async toggleActive(id: string, isActive: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { is_active: isActive });
  }

  async deleteTrainer(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('trainers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
