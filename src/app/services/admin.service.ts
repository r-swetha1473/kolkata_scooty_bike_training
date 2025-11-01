import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

interface DashboardStats {
  totalBookings: number;
  activeSlots: number;
  totalTrainers: number;
  todaySessions: number;
  pendingBookings: number;
  completedToday: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(
    private supabase: SupabaseService,
    private auth: AuthService
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalBookingsResult,
      activeSlotsResult,
      totalTrainersResult,
      todaySessionsResult,
      pendingBookingsResult,
      completedTodayResult
    ] = await Promise.all([
      this.supabase.client.from('bookings').select('id', { count: 'exact', head: true }),
      this.supabase.client.from('slots').select('id', { count: 'exact', head: true }).eq('status', 'available'),
      this.supabase.client.from('trainers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      this.supabase.client.from('slots').select('id', { count: 'exact', head: true })
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString()),
      this.supabase.client.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      this.supabase.client.from('bookings').select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', today.toISOString())
    ]);

    return {
      totalBookings: totalBookingsResult.count || 0,
      activeSlots: activeSlotsResult.count || 0,
      totalTrainers: totalTrainersResult.count || 0,
      todaySessions: todaySessionsResult.count || 0,
      pendingBookings: pendingBookingsResult.count || 0,
      completedToday: completedTodayResult.count || 0
    };
  }

  async getAllBookings(filters?: { status?: string; trainerId?: string; startDate?: string; endDate?: string }) {
    let query = this.supabase.client
      .from('bookings')
      .select(`
        *,
        user:profiles!bookings_user_id_fkey (full_name, email, phone),
        slot:slots!bookings_slot_id_fkey (start_time, end_time),
        trainer:trainers!bookings_trainer_id_fkey (
          id,
          profile:profiles!trainers_user_id_fkey (full_name)
        )
      `);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.trainerId) {
      query = query.eq('trainer_id', filters.trainerId);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async updateBookingStatus(bookingId: string, status: string, notes?: string) {
    const user = this.auth.getUserProfile();
    if (!user) throw new Error('Unauthorized');

    const { data: oldBooking } = await this.supabase.client
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    const updateData: any = { status };
    if (notes) updateData.notes = notes;

    const { data, error } = await (this.supabase.client
      .from('bookings')
      .update(updateData as any)
      .eq('id', bookingId)
      .select()
      .single() as any);

    if (error) throw error;

    await this.createAuditLog({
      action: 'update_booking_status',
      entity_type: 'booking',
      entity_id: bookingId,
      old_data: oldBooking,
      new_data: data
    });

    return data;
  }

  async createSlot(slotData: {
    trainer_id: string;
    start_time: string;
    end_time: string;
    capacity: number;
  }) {
    const insertData: any = {
      ...slotData,
      status: 'available',
      booked_count: 0
    };

    const { data, error } = await this.supabase.client
      .from('slots')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await this.createAuditLog({
      action: 'create_slot',
      entity_type: 'slot',
      entity_id: (data as any)?.id || null,
      new_data: data
    });

    return data;
  }

  async updateSlot(slotId: string, updates: any) {
    const { data: oldSlot } = await this.supabase.client
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single();

    const { data, error } = await (this.supabase.client
      .from('slots')
      .update(updates as any)
      .eq('id', slotId)
      .select()
      .single() as any);

    if (error) throw error;

    await this.createAuditLog({
      action: 'update_slot',
      entity_type: 'slot',
      entity_id: slotId,
      old_data: oldSlot,
      new_data: data
    });

    return data;
  }

  async deleteSlot(slotId: string) {
    const { data: oldSlot } = await this.supabase.client
      .from('slots')
      .select('*')
      .eq('id', slotId)
      .single();

    const { error } = await this.supabase.client
      .from('slots')
      .delete()
      .eq('id', slotId);

    if (error) throw error;

    await this.createAuditLog({
      action: 'delete_slot',
      entity_type: 'slot',
      entity_id: slotId,
      old_data: oldSlot
    });
  }

  async getAllTrainers() {
    const { data, error } = await this.supabase.client
      .from('trainers')
      .select(`
        *,
        profile:profiles!trainers_user_id_fkey (full_name, email, phone, avatar_url)
      `)
      .order('rating', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateTrainer(trainerId: string, updates: any) {
    const { data, error } = await (this.supabase.client
      .from('trainers')
      .update(updates as any)
      .eq('id', trainerId)
      .select()
      .single() as any);

    if (error) throw error;

    await this.createAuditLog({
      action: 'update_trainer',
      entity_type: 'trainer',
      entity_id: trainerId,
      new_data: data
    });

    return data;
  }

  async getAllUsers(filters?: { role?: string }) {
    let query = this.supabase.client
      .from('profiles')
      .select('*');

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async updateUserRole(userId: string, role: string) {
    if (!this.auth.isSuperAdmin()) {
      throw new Error('Only superadmins can update user roles');
    }

    const { data, error } = await (this.supabase.client
      .from('profiles')
      .update({ role } as any)
      .eq('id', userId)
      .select()
      .single() as any);

    if (error) throw error;

    await this.createAuditLog({
      action: 'update_user_role',
      entity_type: 'profile',
      entity_id: userId,
      new_data: { role }
    });

    return data;
  }

  async getAuditLogs(limit = 100) {
    const { data, error } = await this.supabase.client
      .from('audit_logs')
      .select(`
        *,
        user:profiles!audit_logs_user_id_fkey (full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getSettings() {
    const { data, error } = await this.supabase.client
      .from('settings')
      .select('*');

    if (error) throw error;
    return data;
  }

  async updateSetting(key: string, value: any, description?: string) {
    const user = this.auth.getUserProfile();
    if (!user) throw new Error('Unauthorized');

    const upsertData: any = {
      key,
      value,
      description: description || '',
      updated_by: user.id
    };

    const { data, error } = await this.supabase.client
      .from('settings')
      .upsert(upsertData)
      .select()
      .single();

    if (error) throw error;

    await this.createAuditLog({
      action: 'update_setting',
      entity_type: 'setting',
      entity_id: key,
      new_data: { key, value }
    });

    return data;
  }

  private async createAuditLog(log: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    old_data?: any;
    new_data?: any;
  }) {
    const user = this.auth.getUserProfile();

    await this.supabase.client.from('audit_logs').insert({
      user_id: user?.id || null,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id || null,
      old_data: log.old_data || null,
      new_data: log.new_data || null,
      ip_address: null
    } as any);
  }
}
