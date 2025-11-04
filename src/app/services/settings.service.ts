import { Injectable } from '@angular/core';
<<<<<<< HEAD
import { BehaviorSubject, Observable } from 'rxjs';
=======
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
>>>>>>> 9f3c0cc (Enhance slot management system and clean up unused files)
import { environment } from '../../environments/environment';

export interface Setting {
  key: string;
  value: any;
  description: string;
  updated_at: string;
  updated_by?: string;
}

export interface SiteSettings {
  site_name: string;
  site_logo: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  social_facebook: string;
  social_instagram: string;
  social_youtube: string;
  footer_copyright: string;
  about_text: string;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
<<<<<<< HEAD
  private apiUrl = environment.apiUrl;
=======
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
>>>>>>> 9f3c0cc (Enhance slot management system and clean up unused files)
  private settingsSubject = new BehaviorSubject<SiteSettings>({
    site_name: 'Kolkata Scotty',
    site_logo: '',
    contact_email: 'contact@kolkatascotty.com',
    contact_phone: '+91 1234567890',
    contact_address: 'Kolkata, West Bengal, India',
    social_facebook: '',
    social_instagram: '',
    social_youtube: '',
    footer_copyright: '© 2025 Kolkata Scotty. All rights reserved.',
    about_text: 'We are dedicated to providing quality bike training services in Kolkata.'
  });

  public settings$: Observable<SiteSettings> = this.settingsSubject.asObservable();
  private loadingPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {
    // Load settings once when service is instantiated
    this.loadSettings();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  async loadSettings(): Promise<void> {
<<<<<<< HEAD
    try {
      const response = await fetch(`${this.apiUrl}/settings`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();

      if (data) {
        const settingsObj: any = {};
        data.forEach((setting: Setting) => {
          settingsObj[setting.key] = setting.value;
        });
        this.settingsSubject.next(settingsObj);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
=======
    // If already loading, return the existing promise
    if (this.loadingPromise) {
      return this.loadingPromise;
>>>>>>> 9f3c0cc (Enhance slot management system and clean up unused files)
    }

    this.loadingPromise = (async () => {
      try {
        const settings = await firstValueFrom(
          this.http.get<SiteSettings>(`${this.apiUrl}/settings`)
        );
        if (settings) {
          this.settingsSubject.next(settings);
        }
      } catch (error: any) {
        // Silently handle rate limiting errors
        if (error?.status === 429) {
          console.log('Rate limited loading settings, will retry');
          return;
        }
        console.error('Error loading settings:', error);
      } finally {
        // Reset loading promise after a delay to allow for future refreshes
        setTimeout(() => {
          this.loadingPromise = null;
        }, 5000);
      }
    })();

    return this.loadingPromise;
  }

  getSettings(): SiteSettings {
    return this.settingsSubject.value;
  }

  async getSetting(key: string): Promise<any> {
<<<<<<< HEAD
    const response = await fetch(`${this.apiUrl}/settings/${key}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch setting');
    const data = await response.json();
    return data?.value;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error('Failed to update setting');
=======
    try {
      const result = await firstValueFrom(
        this.http.get<{ key: string; value: any }>(`${this.apiUrl}/settings/${key}`)
      );
      return result.value;
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async updateSetting(key: string, value: any): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiUrl}/settings/${key}`, { value }, {
        headers: this.getAuthHeaders()
      })
    );
>>>>>>> 9f3c0cc (Enhance slot management system and clean up unused files)
    await this.loadSettings();
  }

  async updateSettings(settings: Partial<SiteSettings>): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.apiUrl}/settings`, settings, {
        headers: this.getAuthHeaders()
      })
    );
    await this.loadSettings();
  }

  async getAllSettings(): Promise<Setting[]> {
<<<<<<< HEAD
    const response = await fetch(`${this.apiUrl}/settings`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return await response.json();
=======
    return firstValueFrom(
      this.http.get<Setting[]>(`${this.apiUrl}/settings/all`, {
        headers: this.getAuthHeaders()
      })
    );
>>>>>>> 9f3c0cc (Enhance slot management system and clean up unused files)
  }
}
