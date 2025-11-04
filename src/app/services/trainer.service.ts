import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
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
  on_duty?: boolean;
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
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  async getAllTrainers(): Promise<Trainer[]> {
    // Note: This endpoint may need to be added to backend if it doesn't exist
    // For now, using the active trainers endpoint which exists
    return this.getActiveTrainers();
  }

  async getActiveTrainers(): Promise<Trainer[]> {
    return firstValueFrom(
      this.http.get<Trainer[]>(`${this.apiUrl}/trainers`)
    );
  }

  async getOnDutyTrainers(): Promise<Trainer[]> {
    // Note: This may need a separate endpoint or filtering
    const allTrainers = await this.getActiveTrainers();
    return allTrainers.filter(t => t.on_duty === true);
  }

  async getTrainerById(id: string): Promise<Trainer | null> {
    try {
      return await firstValueFrom(
        this.http.get<Trainer>(`${this.apiUrl}/trainers/${id}`)
      );
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async createTrainer(trainer: Partial<Trainer>): Promise<Trainer> {
    return firstValueFrom(
      this.http.post<Trainer>(`${this.apiUrl}/trainers`, trainer, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer> {
    return firstValueFrom(
      this.http.put<Trainer>(`${this.apiUrl}/trainers/${id}`, updates, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async toggleOnDuty(id: string, onDuty: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { on_duty: onDuty });
  }

  async toggleActive(id: string, isActive: boolean): Promise<Trainer> {
    return this.updateTrainer(id, { is_active: isActive });
  }

  async deleteTrainer(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/trainers/${id}`, {
        headers: this.getAuthHeaders()
      })
    );
  }
}
