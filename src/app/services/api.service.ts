import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/auth-token.storage';

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
  profile?: {
    full_name: string;
    email?: string;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

export interface Slot {
  id: string;
  trainer_id?: string | null;
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
  private apiUrl = environment.apiUrl || 'https://kolkata-scooty-bike-training-1ild.onrender.com/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.captureOAuthTokenFromUrl();
    this.loadUserFromToken();
  }

  private captureOAuthTokenFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      if (!token) {
        return;
      }

      setAuthToken(token);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
  }

  private loadUserFromToken() {
    this.http.get<User>(`${this.apiUrl}/auth/me`, this.getHttpOptions(true)).subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
      },
      error: () => {
        const token = getAuthToken();
        if (token) {
          this.http.get<User>(`${this.apiUrl}/profiles/me`, this.getHttpOptions(true)).subscribe({
            next: (user) => this.currentUserSubject.next(user),
            error: () => {
              clearAuthToken();
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
    const token = getAuthToken();
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
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
    setAuthToken(token);
    this.loadUserFromToken();
  }

  signInWithGoogle() {
    window.location.href = `${this.apiUrl}/auth/google`;
  }

  signOut(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        clearAuthToken();
        this.currentUserSubject.next(null);
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getProfile(): Observable<User> {
    // Try /auth/me first (supports cookie auth), fallback to /profiles/me
    return this.http.get<User>(`${this.apiUrl}/auth/me`, this.getHttpOptions(true));
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

  /** Active trainers for booking UI; each slot may use any active trainer once per booking (enforced on submit). */
  getAvailableTrainersForSlot(slotId: string): Observable<Trainer[]> {
    return this.http.get<Trainer[]>(
      `${this.apiUrl}/trainers/available-for-slot/${encodeURIComponent(slotId)}`,
      this.getHttpOptions(false)
    );
  }

  getSlots(params?: { trainer_id?: string; start_date?: string; end_date?: string }): Observable<Slot[]> {
    let url = `${this.apiUrl}/slots?`;
    if (params?.trainer_id) url += `trainer_id=${params.trainer_id}&`;
    if (params?.start_date) url += `start_date=${params.start_date}&`;
    if (params?.end_date) url += `end_date=${params.end_date}&`;
    return this.http.get<Slot[]>(url, this.getHttpOptions(false));
  }

  /**
   * Create booking: customer chooses trainer_id; server assigns vehicle. slot_id + trainer_id + phone typical.
   */
  createBooking(
    slotId: string,
    options?: { phone?: string; notes?: string; trainer_id?: string }
  ): Observable<Booking> {
    const payload: Record<string, string> = {
      slot_id: slotId,
      notes: (options?.notes ?? '').trim()
    };
    const phone = options?.phone?.trim();
    if (phone) {
      payload.phone = phone;
    }
    const tid = options?.trainer_id?.trim();
    if (tid) {
      payload.trainer_id = tid;
    }
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, payload, this.getHttpOptions(true));
  }

  getVehicles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/vehicles`);
  }

  getMyBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/my-bookings`, {
      headers: this.getAuthHeaders(),
      withCredentials: true
    });
  }

  cancelBooking(bookingId: string, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/bookings/${bookingId}/cancel`, {
      cancellation_reason: reason
    }, {
      headers: this.getAuthHeaders(),
      withCredentials: true
    });
  }

  submitRating(bookingId: string, ratingValue: number, comments?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ratings`, {
      booking_id: bookingId,
      rating_value: ratingValue,
      comments: comments || ''
    }, {
      headers: this.getAuthHeaders(),
      withCredentials: true
    });
  }

  /** Admin bookings list (paginated JSON: { bookings, total, limit, offset }). */
  getAllBookings(): Observable<{ bookings: Booking[]; total: number }> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/bookings`, this.getHttpOptions(true))
      .pipe(
        map((r) => ({
          bookings: Array.isArray(r?.bookings) ? r.bookings : [],
          total: typeof r?.total === 'number' ? r.total : 0
        }))
      );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/admin/users`, this.getHttpOptions(true));
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard`, this.getHttpOptions(true));
  }

  /**
   * Sends Bearer token + cookies when present (required for /auth/me, /profiles/me, etc.).
   * Safe for public routes too — extra Authorization is ignored by the server.
   */
  get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.apiUrl}${path}`, this.getHttpOptions(true)));
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
