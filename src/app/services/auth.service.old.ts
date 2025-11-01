import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'customer' | 'trainer' | 'admin' | 'superadmin';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$: Observable<UserProfile | null> = this.userProfileSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {
    this.supabase.currentUser$.pipe(
      switchMap(user => {
        if (user) {
          return from(this.supabase.getUserProfile(user.id));
        }
        return from(Promise.resolve(null));
      })
    ).subscribe(profile => {
      this.userProfileSubject.next(profile);
    });
  }

  async signInWithGoogle() {
    try {
      await this.supabase.signInWithGoogle();
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signInWithEmailPassword(email: string, password: string) {
    try {
      const { user } = await this.supabase.signInWithEmailPassword(email, password);
      if (user) {
        const profile = await this.supabase.getUserProfile(user.id);
        this.userProfileSubject.next(profile);
        return profile;
      }
      return null;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signOut() {
    try {
      await this.supabase.signOut();
      this.userProfileSubject.next(null);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  get isAuthenticated$(): Observable<boolean> {
    return this.supabase.currentUser$.pipe(map(user => !!user));
  }

  isAuthenticated(): boolean {
    return !!this.supabase.getCurrentUser();
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

  async updateProfile(updates: Partial<UserProfile>) {
    const user = this.supabase.getCurrentUser();
    if (!user) throw new Error('No authenticated user');

    const updatedProfile = await this.supabase.createOrUpdateProfile(user.id, updates);
    this.userProfileSubject.next(updatedProfile);
    return updatedProfile;
  }
}
