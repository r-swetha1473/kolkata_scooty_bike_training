import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
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
  private apiUrl = environment.apiUrl;
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

  constructor() {
    this.loadSettings();
  }

  async loadSettings(): Promise<void> {
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
    }
  }

  getSettings(): SiteSettings {
    return this.settingsSubject.value;
  }

  async getSetting(key: string): Promise<any> {
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
    await this.loadSettings();
  }

  async updateSettings(settings: Partial<SiteSettings>): Promise<void> {
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
    }));

    for (const update of updates) {
      await this.updateSetting(update.key, update.value);
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    const response = await fetch(`${this.apiUrl}/settings`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return await response.json();
  }
}
