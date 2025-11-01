import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: 'customer' | 'trainer' | 'admin' | 'superadmin';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      trainers: {
        Row: {
          id: string;
          user_id: string;
          bio: string;
          experience_years: number;
          specialization: string[];
          rating: number;
          total_sessions: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trainers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['trainers']['Insert']>;
      };
      slots: {
        Row: {
          id: string;
          trainer_id: string;
          start_time: string;
          end_time: string;
          capacity: number;
          booked_count: number;
          status: 'available' | 'full' | 'cancelled' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['slots']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['slots']['Insert']>;
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          slot_id: string;
          trainer_id: string;
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
          notes: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: any;
          new_data: any;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      settings: {
        Row: {
          key: string;
          value: any;
          description: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient<any>;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private sessionSubject = new BehaviorSubject<Session | null>(null);

  currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  session$: Observable<Session | null> = this.sessionSubject.asObservable();

  constructor() {
    this.supabase = createClient<any>(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.sessionSubject.next(session);
      this.currentUserSubject.next(session?.user ?? null);
    });

    this.initializeAuth();
  }

  private async initializeAuth() {
    const { data } = await this.supabase.auth.getSession();
    this.sessionSubject.next(data.session);
    this.currentUserSubject.next(data.session?.user ?? null);
  }

  get client(): SupabaseClient<any> {
    return this.supabase;
  }

  get auth() {
    return this.supabase.auth;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getSession(): Session | null {
    return this.sessionSubject.value;
  }

  async signInWithGoogle() {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/booking`
      }
    });

    if (error) throw error;
    return data;
  }

  async signInWithEmailPassword(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getUserProfile(userId: string) {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createOrUpdateProfile(userId: string, profile: Partial<Database['public']['Tables']['profiles']['Insert']>) {
    const { data, error } = await this.supabase
      .from('profiles')
      .upsert({ id: userId, ...profile } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
