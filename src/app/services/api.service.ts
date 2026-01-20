import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'customer' | 'trainer' | 'admin' | 'superadmin';
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  user_id: string;
  bio: string;
  experience_years: number;
  specialization: string[];
  rating: number;
  total_sessions: number;
  is_active: boolean;
  full_name?: string;
  avatar_url?: string;
}

export interface Slot {
  id: string;
  trainer_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed' | 'disabled';
  trainer_name?: string;
  is_auto_generated?: boolean;
}

export interface Booking {
  id: string;
  user_id: string;
  slot_id: string;
  trainer_id: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  start_time?: string;
  end_time?: string;
  trainer_name?: string;
  trainer_avatar?: string;
  created_at?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl || 'https://kolkata-scooty-bike-training.onrender.com/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromToken();
  }

  // TODO: Migrate to httpOnly cookies for secure token storage
  // Currently using sessionStorage as temporary fix (tokens cleared on tab close)
  private loadUserFromToken() {
    // Try to load user from either sessionStorage token OR httpOnly cookie
    // Cookie-based auth (from Google OAuth) is preferred
    this.http.get<User>(`${this.apiUrl}/auth/me`, this.getHttpOptions(false)).subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
      },
      error: () => {
        // If cookie auth fails, try sessionStorage token (for email/password login)
        const token = sessionStorage.getItem('token');
        if (token) {
          this.http.get<User>(`${this.apiUrl}/profiles/me`, this.getHttpOptions(true)).subscribe({
            next: (user) => this.currentUserSubject.next(user),
            error: () => {
              sessionStorage.removeItem('token');
              this.currentUserSubject.next(null);
            }
          });
        } else {
          this.currentUserSubject.next(null);
        }
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    // Only add Authorization header if token exists (for backward compatibility)
    // Cookie-based auth (httpOnly) is preferred and doesn't need Authorization header
    if (token) {
      return headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private getHttpOptions(includeAuth = true) {
    return {
      headers: includeAuth ? this.getAuthHeaders() : new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true // Always send cookies for authentication
    };
  }

  setToken(token: string) {
    sessionStorage.setItem('token', token);
    this.loadUserFromToken();
  }

  signInWithGoogle() {
    window.location.href = `${this.apiUrl}/auth/google`;
  }

  signOut(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        sessionStorage.removeItem('token');
        this.currentUserSubject.next(null);
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getProfile(): Observable<User> {
    // Try /auth/me first (supports cookie auth), fallback to /profiles/me
    return this.http.get<User>(`${this.apiUrl}/auth/me`, this.getHttpOptions(false));
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profiles/me`, data, this.getHttpOptions(true));
  }

  getTrainers(): Observable<Trainer[]> {
    return this.http.get<Trainer[]>(`${this.apiUrl}/trainers`, this.getHttpOptions(false));
  }

  getTrainer(id: string): Observable<Trainer> {
    return this.http.get<Trainer>(`${this.apiUrl}/trainers/${id}`, this.getHttpOptions(false));
  }

  getSlots(params?: { trainer_id?: string; start_date?: string; end_date?: string }): Observable<Slot[]> {
    let url = `${this.apiUrl}/slots?`;
    if (params?.trainer_id) url += `trainer_id=${params.trainer_id}&`;
    if (params?.start_date) url += `start_date=${params.start_date}&`;
    if (params?.end_date) url += `end_date=${params.end_date}&`;
    return this.http.get<Slot[]>(url, this.getHttpOptions(false));
  }

  createBooking(slotId: string, trainerId: string, vehicleId: string, notes?: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, {
      slot_id: slotId,
      trainer_id: trainerId,
      vehicle_id: vehicleId,
      notes: notes || ''
    }, {
      headers: this.getAuthHeaders()
    });
  }

  getVehicles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/vehicles`);
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/my-bookings`, {
      headers: this.getAuthHeaders()
    });
  }

  cancelBooking(bookingId: string, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/bookings/${bookingId}/cancel`, {
      cancellation_reason: reason
    }, {
      headers: this.getAuthHeaders()
    });
  }

  submitRating(bookingId: string, ratingValue: number, comments?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ratings`, {
      booking_id: bookingId,
      rating_value: ratingValue,
      comments: comments || ''
    }, {
      headers: this.getAuthHeaders()
    });
  }

  getAllBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/admin/bookings`, this.getHttpOptions(true));
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/admin/users`, this.getHttpOptions(true));
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard`, this.getHttpOptions(true));
  }

  get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.apiUrl}${path}`, this.getHttpOptions(false)));
  }

  post<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.apiUrl}${path}`, body, this.getHttpOptions(true)));
  }

  put<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.apiUrl}${path}`, body, this.getHttpOptions(true)));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.apiUrl}${path}`, this.getHttpOptions(true)));
  }
}
