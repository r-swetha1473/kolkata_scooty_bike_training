import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpService } from './http.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'customer' | 'trainer' | 'admin' | 'superadmin';
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$: Observable<UserProfile | null> = this.userProfileSubject.asObservable();

  constructor(
    private http: HttpService,
    private router: Router
  ) {
    this.loadUserFromToken();
  }

  private loadUserFromToken() {
    const token = localStorage.getItem('token');
    if (token) {
      this.http.get<UserProfile>('/auth/me').subscribe({
        next: (user) => this.userProfileSubject.next(user),
        error: () => {
          localStorage.removeItem('token');
          this.userProfileSubject.next(null);
        }
      });
    }
  }

  signInWithGoogle(): void {
    window.location.href = `${this.http['apiUrl']}/auth/google`;
  }

  async signInWithEmailPassword(email: string, password: string): Promise<UserProfile | null> {
    try {
      const response = await this.http.post<AuthResponse>('/auth/login', { email, password }).toPromise();
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        this.userProfileSubject.next(response.user);
        return response.user;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.http.post('/auth/logout', {}).toPromise();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      this.userProfileSubject.next(null);
      this.router.navigate(['/']);
    }
  }

  get isAuthenticated$(): Observable<boolean> {
    return new Observable(observer => {
      this.userProfile$.subscribe(user => observer.next(!!user));
    });
  }

  isAuthenticated(): boolean {
    return !!this.userProfileSubject.value;
  }

  getUserProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }

  hasRole(roles: string[]): boolean {
    const profile = this.getUserProfile();
    return profile ? roles.includes(profile.role) : false;
  }

  isAdmin(): boolean {
    return this.hasRole(['admin', 'superadmin']);
  }

  isSuperAdmin(): boolean {
    return this.hasRole(['superadmin']);
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const updatedProfile = await this.http.put<UserProfile>('/profiles/me', updates).toPromise();
    if (updatedProfile) {
      this.userProfileSubject.next(updatedProfile);
      return updatedProfile;
    }
    throw new Error('Failed to update profile');
  }
}
