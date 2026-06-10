import { Injectable } from '@angular/core';

import { Router } from '@angular/router';

import { HttpService } from './http.service';

import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { map } from 'rxjs/operators';

import { getAuthToken, setAuthToken, clearAuthToken } from '../utils/auth-token.storage';



export interface ModulePermission {

  module: string;

  can_view: boolean;

  can_create: boolean;

  can_edit: boolean;

  can_delete: boolean;

}



export interface UserProfile {

  id: string;

  email: string;

  full_name: string;

  phone: string | null;

  avatar_url: string | null;

  role: 'customer' | 'trainer' | 'admin' | 'superadmin' | 'subadmin';

  inactive_blocked?: boolean;

  admin_is_active?: boolean;

  must_change_password?: boolean;

  last_booking_date?: string | null;

  permissions?: ModulePermission[];

}



export interface AuthResponse {

  token?: string;

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

    this.handleOAuthRedirect();

    this.loadUserFromToken();

  }



  private handleOAuthRedirect(): void {

    try {

      const url = new URL(window.location.href);
      const token = url.searchParams.get('token')?.trim();

      if (token) {
        setAuthToken(token);
        url.searchParams.delete('token');
      }

      if (url.searchParams.get('oauth') === 'success') {

        url.searchParams.delete('oauth');

        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

      }

    } catch {

      /* ignore */

    }

  }



  private loadUserFromToken() {

    this.http.get<UserProfile>('/auth/me').subscribe({

      next: (user) => this.userProfileSubject.next(user),

      error: () => {

        clearAuthToken();

        this.userProfileSubject.next(null);

      }

    });

  }



  reloadUserProfile(): void {

    this.loadUserFromToken();

  }



  signInWithGoogle(): void {

    window.location.href = `${this.http['apiUrl']}/auth/google`;

  }



  async signInWithEmailPassword(email: string, password: string): Promise<UserProfile | null> {

    const response = await firstValueFrom(this.http.post<AuthResponse>('/auth/login', { email, password }));

    if (response?.token) {

      setAuthToken(response.token);

    }

    if (response?.user) {

      this.userProfileSubject.next(response.user);

      return response.user;

    }

    return null;

  }



  async signOut(): Promise<void> {

    try {

      await firstValueFrom(this.http.post('/auth/logout', {}));

    } catch {

      /* still clear local session */

    } finally {

      clearAuthToken();

      this.userProfileSubject.next(null);

      this.router.navigate(['/']);

    }

  }



  readonly isAuthenticated$ = this.userProfile$.pipe(map((user) => !!user));



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

    return this.hasRole(['admin', 'superadmin', 'subadmin']);

  }



  isSuperAdmin(): boolean {

    return this.hasRole(['superadmin']);

  }



  isSubAdmin(): boolean {

    return this.hasRole(['subadmin']);

  }

  clearMustChangePassword(): void {
    const profile = this.getUserProfile();
    if (profile) {
      this.userProfileSubject.next({ ...profile, must_change_password: false });
    }
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


