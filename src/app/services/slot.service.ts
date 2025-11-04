import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Slot {
  id: string;
  trainer_id?: string;
  start_time: string;
  end_time: string;
  slot_date: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed' | 'disabled';
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  trainer?: {
    id: string;
    profile: {
      full_name: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SlotService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  async generateDailySlots(date?: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/slots/generate-daily`, { date }, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async getSlotsByDate(date: string): Promise<Slot[]> {
    return firstValueFrom(
      this.http.get<Slot[]>(`${this.apiUrl}/slots/date/${date}`)
    );
  }

  async getSlotsByDateRange(startDate: string, endDate: string): Promise<Slot[]> {
    // Format dates to include full day range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    // Use the base route with query parameters as it already supports start_date and end_date
    return firstValueFrom(
      this.http.get<Slot[]>(`${this.apiUrl}/slots?start_date=${start.toISOString()}&end_date=${end.toISOString()}`)
    );
  }

  async getAvailableSlots(date?: string): Promise<Slot[]> {
    const url = date 
      ? `${this.apiUrl}/slots/available?date=${date}`
      : `${this.apiUrl}/slots/available`;
    return firstValueFrom(this.http.get<Slot[]>(url));
  }

  async getSlotById(id: string): Promise<Slot | null> {
    try {
      return await firstValueFrom(
        this.http.get<Slot>(`${this.apiUrl}/slots/${id}`)
      );
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async createSlot(slot: Partial<Slot>): Promise<Slot> {
    return firstValueFrom(
      this.http.post<Slot>(`${this.apiUrl}/slots`, slot, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async updateSlot(id: string, updates: Partial<Slot>): Promise<Slot> {
    return firstValueFrom(
      this.http.put<Slot>(`${this.apiUrl}/slots/${id}`, updates, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async assignTrainer(slotId: string, trainerId: string): Promise<Slot> {
    return firstValueFrom(
      this.http.put<Slot>(`${this.apiUrl}/slots/${slotId}/trainer`, { trainer_id: trainerId }, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async unassignTrainer(slotId: string): Promise<Slot> {
    return firstValueFrom(
      this.http.put<Slot>(`${this.apiUrl}/slots/${slotId}/trainer`, { trainer_id: null }, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async updateSlotStatus(slotId: string, status: 'available' | 'cancelled' | 'full' | 'completed'): Promise<Slot> {
    return firstValueFrom(
      this.http.put<Slot>(`${this.apiUrl}/slots/${slotId}/status`, { status }, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async deleteSlot(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/slots/${id}`, {
        headers: this.getAuthHeaders()
      })
    );
  }

  async deleteSlotsByDate(date: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/slots/date/${date}`, {
        headers: this.getAuthHeaders()
      })
    );
  }
}
