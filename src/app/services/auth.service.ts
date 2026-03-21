import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpService } from './http.service';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
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

      sessionStorage.setItem('token', token);
      url.searchParams.delete('token');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch (error) {
      console.error('Failed to capture OAuth token from URL:', error);
    }
  }

  // Load user from token (sessionStorage) or httpOnly cookie
  private loadUserFromToken() {
    // Check sessionStorage first (for email/password login)
    const token = sessionStorage.getItem('token');
    if (token) {
      this.http.get<UserProfile>('/auth/me').subscribe({
        next: (user) => this.userProfileSubject.next(user),
        error: () => {
          sessionStorage.removeItem('token');
          this.userProfileSubject.next(null);
        }
      });
    } else {
      // No sessionStorage token - check for httpOnly cookie (from Google OAuth)
      // Make API call with credentials to check if cookie exists
      this.http.get<UserProfile>('/auth/me').subscribe({
        next: (user) => {
          // User authenticated via cookie - update state
          this.userProfileSubject.next(user);
        },
        error: () => {
          // No valid cookie or token - user not authenticated
          this.userProfileSubject.next(null);
        }
      });
    }
  }

  // Public method to reload user profile (useful after OAuth redirect)
  reloadUserProfile(): void {
    this.loadUserFromToken();
  }

  signInWithGoogle(): void {
    window.location.href = `${this.http['apiUrl']}/auth/google`;
  }

  async signInWithEmailPassword(email: string, password: string): Promise<UserProfile | null> {
    try {
      const response = await firstValueFrom(this.http.post<AuthResponse>('/auth/login', { email, password }));
      if (response && response.token) {
        // TODO: Migrate to httpOnly cookies - backend already supports cookie-based auth
        sessionStorage.setItem('token', response.token);
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
      await firstValueFrom(this.http.post('/auth/logout', {}));
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      sessionStorage.removeItem('token');
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
    const updatedProfile = await firstValueFrom(this.http.put<UserProfile>('/profiles/me', updates));
    if (updatedProfile) {
      this.userProfileSubject.next(updatedProfile);
      return updatedProfile;
    }
    throw new Error('Failed to update profile');
  }
}
