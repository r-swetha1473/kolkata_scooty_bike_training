import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable, firstValueFrom } from 'rxjs';
import { ModulePermission } from './auth.service';

export interface SubAdmin {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'subadmin' | 'admin';
  admin_is_active: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at?: string;
  permissions?: ModulePermission[];
}

export interface TrainerDeletePreview {
  trainerId: string;
  trainerName: string;
  isActive: boolean;
  totalBookings: number;
  pendingBookings: number;
  activeBookings: number;
  completedBookings: number;
  blockingBookings: number;
  pastBlockingBookings: number;
  futureBlockingBookings: number;
  canDeleteDirectly: boolean;
  availableReassignTrainers: { id: string; name: string }[];
}

export type TrainerDeleteStrategy = 'direct' | 'complete_all' | 'complete_past' | 'reassign';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private http: HttpService) {}

  async getStats(): Promise<any> {
    return firstValueFrom(this.http.get('/admin/stats'));
  }

  async getDashboardStats(): Promise<any> {
    return firstValueFrom(this.http.get('/admin/stats'));
  }

  async getAllBookings(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ bookings: any[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const search = filters?.search?.trim();
    if (search) params.set('search', search);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    if (filters?.offset != null) params.set('offset', String(filters.offset));
    const qs = params.toString();
    const result = await firstValueFrom(this.http.get<any>(`/admin/bookings${qs ? `?${qs}` : ''}`));
    const bookingsFromTop = Array.isArray(result?.bookings) ? result.bookings : null;
    const bookingsFromData = Array.isArray(result?.data?.bookings) ? result.data.bookings : null;
    const bookingsFromArray = Array.isArray(result) ? result : null;
    const bookings = bookingsFromTop || bookingsFromData || bookingsFromArray || [];

    const totalFromTop = typeof result?.total === 'number' ? result.total : null;
    const totalFromData = typeof result?.data?.total === 'number' ? result.data.total : null;
    const total = totalFromTop ?? totalFromData ?? bookings.length;

    const limitFromTop = typeof result?.limit === 'number' ? result.limit : null;
    const limitFromData = typeof result?.data?.limit === 'number' ? result.data.limit : null;
    const resolvedLimit = limitFromTop ?? limitFromData ?? 50;

    const offsetFromTop = typeof result?.offset === 'number' ? result.offset : null;
    const offsetFromData = typeof result?.data?.offset === 'number' ? result.data.offset : null;
    const resolvedOffset = offsetFromTop ?? offsetFromData ?? 0;

    return {
      bookings,
      total,
      limit: resolvedLimit,
      offset: resolvedOffset
    };
  }

  async getAllTrainers(): Promise<any[]> {
    const result = await firstValueFrom(this.http.get<any[]>('/admin/trainers'));
    return result || [];
  }

  async getAllUsers(): Promise<any[]> {
    const result = await firstValueFrom(this.http.get<any[]>('/admin/users'));
    return result || [];
  }

  async getSettings(): Promise<any> {
    return firstValueFrom(this.http.get('/admin/settings'));
  }

  updateSettings(settings: any): Observable<any> {
    return this.http.put('/admin/settings', settings);
  }

  updateUserRole(userId: string, role: string): Observable<any> {
    return this.http.put(`/admin/users/${userId}/role`, { role });
  }

  createTrainer(trainerData: any): Observable<any> {
    return this.http.post('/admin/trainers', trainerData);
  }

  updateTrainer(trainerId: string, trainerData: any): Observable<any> {
    return this.http.put(`/admin/trainers/${trainerId}`, trainerData);
  }

  getTrainerDeletePreview(trainerId: string): Observable<TrainerDeletePreview> {
    return this.http.get<TrainerDeletePreview>(`/admin/trainers/${trainerId}/delete-preview`);
  }

  deleteTrainer(
    trainerId: string,
    options?: { strategy?: TrainerDeleteStrategy; reassignToTrainerId?: string }
  ): Observable<any> {
    const body = options?.strategy
      ? {
          strategy: options.strategy,
          ...(options.reassignToTrainerId ? { reassignToTrainerId: options.reassignToTrainerId } : {})
        }
      : undefined;
    return this.http.delete(`/admin/trainers/${trainerId}`, body);
  }

  updateBookingStatus(bookingId: string, status: string): Observable<any> {
    return this.http.put(`/admin/bookings/${bookingId}/status`, { status });
  }

  deleteBooking(bookingId: string): Observable<any> {
    return this.http.delete(`/admin/bookings/${bookingId}`);
  }

  createUser(userData: any): Observable<any> {
    return this.http.post('/admin/users', userData);
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`/admin/users/${userId}`);
  }

  updateUser(userId: string, body: Record<string, unknown>): Observable<any> {
    return this.http.put(`/admin/users/${userId}`, body);
  }

  getSubAdmins(): Observable<SubAdmin[]> {
    return this.http.get<SubAdmin[]>('/admin/sub-admins');
  }

  createSubAdmin(payload: {
    email: string;
    full_name: string;
    phone?: string;
    password: string;
    permissions: ModulePermission[];
  }): Observable<SubAdmin> {
    return this.http.post<SubAdmin>('/admin/sub-admins', payload);
  }

  updateSubAdmin(
    id: string,
    payload: Partial<{ full_name: string; email: string; phone: string; permissions: ModulePermission[] }>
  ): Observable<SubAdmin> {
    return this.http.put<SubAdmin>(`/admin/sub-admins/${id}`, payload);
  }

  updateSubAdminStatus(id: string, is_active: boolean): Observable<SubAdmin> {
    return this.http.put<SubAdmin>(`/admin/sub-admins/${id}/status`, { is_active });
  }

  changePassword(payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>('/admin/change-password', payload);
  }

  resetUserPassword(userId: string, password: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`/admin/users/${userId}/reset-password`, { password });
  }

  getAdmins(): Observable<SubAdmin[]> {
    return this.http.get<SubAdmin[]>('/admin/admins');
  }
}
