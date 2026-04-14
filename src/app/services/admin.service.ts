import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable, firstValueFrom } from 'rxjs';

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
    if (filters?.search) params.set('search', filters.search);
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

  deleteTrainer(trainerId: string): Observable<any> {
    return this.http.delete(`/admin/trainers/${trainerId}`);
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
}
