import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
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
  status: 'available' | 'full' | 'cancelled' | 'completed';
  trainer_name?: string;
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
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromToken();
  }

  private loadUserFromToken() {
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.http.get<User>(`${this.apiUrl}/profiles/me`, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: (user) => this.currentUserSubject.next(user),
        error: () => {
          localStorage.removeItem('auth_token');
          this.currentUserSubject.next(null);
        }
      });
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  setToken(token: string) {
    localStorage.setItem('auth_token', token);
    this.loadUserFromToken();
  }

  signInWithGoogle() {
    window.location.href = `${this.apiUrl}/auth/google`;
  }

  signOut(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        localStorage.removeItem('auth_token');
        this.currentUserSubject.next(null);
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/profiles/me`, {
      headers: this.getAuthHeaders()
    });
  }

  updateProfile(data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/profiles/me`, data, {
      headers: this.getAuthHeaders()
    });
  }

  getTrainers(): Observable<Trainer[]> {
    return this.http.get<Trainer[]>(`${this.apiUrl}/trainers`);
  }

  getTrainer(id: string): Observable<Trainer> {
    return this.http.get<Trainer>(`${this.apiUrl}/trainers/${id}`);
  }

  getSlots(params?: { trainer_id?: string; start_date?: string; end_date?: string }): Observable<Slot[]> {
    let url = `${this.apiUrl}/slots?`;
    if (params?.trainer_id) url += `trainer_id=${params.trainer_id}&`;
    if (params?.start_date) url += `start_date=${params.start_date}&`;
    if (params?.end_date) url += `end_date=${params.end_date}&`;
    return this.http.get<Slot[]>(url);
  }

  createBooking(slotId: string, notes?: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, {
      slot_id: slotId,
      notes: notes || ''
    }, {
      headers: this.getAuthHeaders()
    });
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

  getAllBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/admin/bookings`, {
      headers: this.getAuthHeaders()
    });
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/admin/users`, {
      headers: this.getAuthHeaders()
    });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard`, {
      headers: this.getAuthHeaders()
    });
  }
}
