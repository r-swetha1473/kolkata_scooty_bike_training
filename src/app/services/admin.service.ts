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

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDashboardStats(raw: Record<string, unknown> | null | undefined) {
  const s = raw || {};
  return {
    ...s,
    todayBookings: asNumber(s['todayBookings']),
    pendingBookings: asNumber(s['pendingBookings']),
    completedBookings: asNumber(s['completedBookings']),
    cancelledBookings: asNumber(s['cancelledBookings']),
    expiredBookings: asNumber(s['expiredBookings']),
    activeTrainers: asNumber(s['activeTrainers'], asNumber(s['totalTrainers'])),
    totalTrainers: asNumber(s['totalTrainers']),
    activeVehicles: asNumber(s['activeVehicles']),
    totalCustomers: asNumber(s['totalCustomers']),
    onlineBookings: asNumber(s['onlineBookings']),
    offlineBookings: asNumber(s['offlineBookings']),
    todayOnlineBookings: asNumber(s['todayOnlineBookings']),
    todayOfflineBookings: asNumber(s['todayOfflineBookings']),
    totalAttended: asNumber(s['totalAttended']),
    totalNoShows: asNumber(s['totalNoShows']),
    attendanceRate: asNumber(s['attendanceRate']),
    capacityExceededSlots: asNumber(s['capacityExceededSlots']),
    totalBookings: asNumber(s['totalBookings']),
    overdueBookings: Array.isArray(s['overdueBookings']) ? s['overdueBookings'] : [],
    todayOperations: s['todayOperations'] || {},
    systemHealth: s['systemHealth'] || {},
    vehicleAnalytics: Array.isArray(s['vehicleAnalytics']) ? s['vehicleAnalytics'] : [],
    vehicleCharts: s['vehicleCharts'] || { topUsed: [], leastUsed: [] },
    trainerAnalytics: Array.isArray(s['trainerAnalytics']) ? s['trainerAnalytics'] : [],
    trainerCharts: s['trainerCharts'] || { workload: [], assignmentTrend: [] },
    recentAdminActivity: Array.isArray(s['recentAdminActivity']) ? s['recentAdminActivity'] : [],
    slotUtilization: Array.isArray(s['slotUtilization']) ? s['slotUtilization'] : []
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private http: HttpService) {}

  async getStats(): Promise<any> {
    const result = await firstValueFrom(this.http.get<Record<string, unknown>>('/admin/stats'));
    return normalizeDashboardStats(result);
  }

  async getDashboardStats(): Promise<any> {
    const result = await firstValueFrom(this.http.get<Record<string, unknown>>('/admin/stats'));
    return normalizeDashboardStats(result);
  }

  async getAllBookings(filters?: {
    status?: string;
    source?: string;
    attendance?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ bookings: any[]; total: number; limit: number; offset: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.attendance) params.set('attendance', filters.attendance);
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

    const totalFromTop = result?.total;
    const totalFromData = result?.data?.total;
    const parsedTop = Number(totalFromTop);
    const parsedData = Number(totalFromData);
    const total = Number.isFinite(parsedTop)
      ? parsedTop
      : Number.isFinite(parsedData)
        ? parsedData
        : bookings.length;

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

  async createOfflineBooking(payload: Record<string, unknown>): Promise<any> {
    return firstValueFrom(this.http.post<any>('/admin/offline-bookings', payload));
  }

  async searchOfflineCustomers(params: { phone?: string; name?: string }): Promise<any[]> {
    const qs = new URLSearchParams();
    if (params.phone) qs.set('phone', params.phone);
    if (params.name) qs.set('name', params.name);
    const result = await firstValueFrom(
      this.http.get<{ matches: any[] }>(`/admin/offline-bookings/customers/search?${qs.toString()}`)
    );
    return result?.matches || [];
  }

  async getBookingDetail(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/admin/bookings/${id}`));
  }

  async updateBookingAttendance(id: string, attendanceStatus: string): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`/admin/bookings/${id}/attendance`, { attendance_status: attendanceStatus })
    );
  }

  async exportBookings(filters?: {
    status?: string;
    source?: string;
    attendance?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.attendance) params.set('attendance', filters.attendance);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.search) params.set('search', filters.search);
    return firstValueFrom(
      this.http.getBlob(`/admin/bookings/export?${params.toString()}`)
    );
  }

  async getAllTrainers(): Promise<any[]> {
    const result = await firstValueFrom(this.http.get<any[]>('/admin/trainers'));
    return result || [];
  }

  async getAllUsers(filters?: {
    role?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: any[]; total: number; limit: number | null; offset: number }> {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    const search = filters?.search?.trim();
    if (search) params.set('search', search);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    if (filters?.offset != null) params.set('offset', String(filters.offset));
    const qs = params.toString();

    const result = await firstValueFrom(
      this.http.get<any>(`/admin/users${qs ? `?${qs}` : ''}`)
    );

    const usersFromTop = Array.isArray(result?.users) ? result.users : null;
    const usersFromData = Array.isArray(result?.data?.users) ? result.data.users : null;
    const usersFromArray = Array.isArray(result) ? result : null;
    const users = usersFromTop || usersFromData || usersFromArray || [];

    const totalRaw = result?.total ?? result?.data?.total;
    const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : users.length;

    const limitRaw = result?.limit ?? result?.data?.limit;
    const offsetRaw = result?.offset ?? result?.data?.offset;

    return {
      users,
      total,
      limit: limitRaw != null ? Number(limitRaw) : null,
      offset: Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : 0
    };
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

  assignBookingTrainer(bookingId: string, trainerId: string | null): Observable<any> {
    return this.http.put(`/admin/bookings/${bookingId}/trainer`, { trainer_id: trainerId });
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
    confirm_password: string;
    admin_is_active?: boolean;
    permissions: ModulePermission[];
  }): Observable<SubAdmin> {
    return this.http.post<SubAdmin>('/admin/sub-admins', payload);
  }

  updateSubAdmin(
    id: string,
    payload: Partial<{
      full_name: string;
      email: string;
      phone: string;
      admin_is_active: boolean;
      permissions: ModulePermission[];
    }>
  ): Observable<SubAdmin> {
    return this.http.put<SubAdmin>(`/admin/sub-admins/${id}`, payload);
  }

  updateSubAdminStatus(id: string, is_active: boolean): Observable<SubAdmin> {
    return this.http.put<SubAdmin>(`/admin/sub-admins/${id}/status`, { is_active });
  }

  deleteSubAdmin(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/admin/sub-admins/${id}`);
  }

  createAdmin(payload: {
    email: string;
    full_name: string;
    phone?: string;
    password: string;
    confirm_password: string;
    admin_is_active?: boolean;
  }): Observable<SubAdmin> {
    return this.http.post<SubAdmin>('/admin/admins', payload);
  }

  updateAdmin(
    id: string,
    payload: Partial<{ full_name: string; email: string; phone: string; admin_is_active: boolean }>
  ): Observable<SubAdmin> {
    return this.http.put<SubAdmin>(`/admin/admins/${id}`, payload);
  }

  deleteAdmin(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/admin/admins/${id}`);
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

  getReactivationRequests(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ requests: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit != null) params.set('limit', String(filters.limit));
    if (filters?.offset != null) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return firstValueFrom(
      this.http.get<{ requests: any[]; total: number }>(
        `/admin/reactivation-requests${qs ? `?${qs}` : ''}`
      )
    );
  }

  approveReactivationRequest(requestId: string): Observable<any> {
    return this.http.put(`/admin/reactivation-requests/${requestId}/approve`, {});
  }

  rejectReactivationRequest(requestId: string, adminNotes?: string): Observable<any> {
    return this.http.put(`/admin/reactivation-requests/${requestId}/reject`, {
      admin_notes: adminNotes || ''
    });
  }
}
