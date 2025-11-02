import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

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
  private supabase: SupabaseClient;
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
    const supabaseUrl = (window as any).ENV?.VITE_SUPABASE_URL || 'https://yvcdcmthcognzodgfvjq.supabase.co';
    const supabaseKey = (window as any).ENV?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Y2RjbXRoY29nbnpvZGdmdmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwODY0MDMsImV4cCI6MjA3NzY2MjQwM30.Z2uJXAvEudnV6IvHPJxi-zJ5uWOv8R5xXV63_AsiTeo';
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .select('*');

      if (error) throw error;

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
    const { data, error } = await this.supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data?.value;
  }

  async updateSetting(key: string, value: any): Promise<void> {
    const { error } = await this.supabase
      .from('settings')
      .update({ value })
      .eq('key', key);

    if (error) throw error;
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
    const { data, error } = await this.supabase
      .from('settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
