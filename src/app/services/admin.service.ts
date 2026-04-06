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

  async getAllBookings(filters?: any): Promise<any[]> {
    let query = '/admin/bookings';
    if (filters) {
      const params = new URLSearchParams(filters).toString();
      query += `?${params}`;
    }
    const result = await firstValueFrom(this.http.get<any[]>(query));
    return result || [];
  }

  async getAllSlots(): Promise<any[]> {
    const result = await firstValueFrom(this.http.get<any[]>('/admin/slots'));
    return result || [];
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

  createSlot(slotData: any): Observable<any> {
    return this.http.post('/admin/slots', slotData);
  }

  updateSlot(slotId: string, slotData: any): Observable<any> {
    return this.http.put(`/admin/slots/${slotId}`, slotData);
  }

  deleteSlot(slotId: string): Observable<any> {
    return this.http.delete(`/admin/slots/${slotId}`);
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
