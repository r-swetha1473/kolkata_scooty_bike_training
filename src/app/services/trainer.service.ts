import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface Trainer {
  id: string;
  user_id: string;
  bio: string;
  experience_years: number;
  specialization: string[];
  rating: number;
  total_sessions: number;
  is_active: boolean;
  on_duty: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string;
    email: string;
    phone?: string;
    avatar_url?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TrainerService {
  private apiUrl = environment.apiUrl;

  constructor() {}

  async getAllTrainers(): Promise<Trainer[]> {
    const response = await fetch(`${this.apiUrl}/trainers`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch trainers');
    return await response.json();
  }

  async getActiveTrainers(): Promise<Trainer[]> {
    const response = await fetch(`${this.apiUrl}/trainers?active=true`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch active trainers');
    return await response.json();
  }

  async getOnDutyTrainers(): Promise<Trainer[]> {
    const response = await fetch(`${this.apiUrl}/trainers?active=true&on_duty=true`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch on-duty trainers');
    return await response.json();
  }

  async getTrainerById(id: string): Promise<Trainer | null> {
    const response = await fetch(`${this.apiUrl}/trainers/${id}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch trainer');
    return await response.json();
  }

  async createTrainer(trainer: Partial<Trainer>): Promise<Trainer> {
    const response = await fetch(`${this.apiUrl}/trainers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(trainer)
    });
    if (!response.ok) throw new Error('Failed to create trainer');
    return await response.json();
  }

  async updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer> {
    const response = await fetch(`${this.apiUrl}/trainers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update trainer');
    return await response.json();
  }

  async toggleOnDuty(id: string, onDuty: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { on_duty: onDuty });
  }

  async toggleActive(id: string, isActive: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { is_active: isActive });
  }

  async deleteTrainer(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/trainers/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete trainer');
  }
}
