import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface Slot {
  id: string;
  trainer_id?: string;
  start_time: string;
  end_time: string;
  slot_date: string;
  capacity: number;
  booked_count: number;
  status: 'available' | 'full' | 'cancelled' | 'completed';
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
  private apiUrl = environment.apiUrl;

  constructor() {}

  async generateDailySlots(date?: string): Promise<any> {
    const body = date ? { date } : {};
    const response = await fetch(`${this.apiUrl}/slots/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Failed to generate slots');
    return await response.json();
  }

  async getSlotsByDate(date: string): Promise<Slot[]> {
    const response = await fetch(`${this.apiUrl}/slots?date=${date}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch slots');
    return await response.json();
  }

  async getSlotsByDateRange(startDate: string, endDate: string): Promise<Slot[]> {
    const response = await fetch(`${this.apiUrl}/slots?start_date=${startDate}&end_date=${endDate}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch slots');
    return await response.json();
  }

  async getAvailableSlots(date?: string): Promise<Slot[]> {
    const url = date
      ? `${this.apiUrl}/slots?date=${date}&available=true`
      : `${this.apiUrl}/slots?available=true`;
    const response = await fetch(url, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch available slots');
    return await response.json();
  }

  async getSlotById(id: string): Promise<Slot | null> {
    const response = await fetch(`${this.apiUrl}/slots/${id}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to fetch slot');
    return await response.json();
  }

  async createSlot(slot: Partial<Slot>): Promise<Slot> {
    const response = await fetch(`${this.apiUrl}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(slot)
    });
    if (!response.ok) throw new Error('Failed to create slot');
    return await response.json();
  }

  async updateSlot(id: string, updates: Partial<Slot>): Promise<Slot> {
    const response = await fetch(`${this.apiUrl}/slots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update slot');
    return await response.json();
  }

  async assignTrainer(slotId: string, trainerId: string): Promise<Slot> {
    return this.updateSlot(slotId, { trainer_id: trainerId });
  }

  async unassignTrainer(slotId: string): Promise<Slot> {
    return this.updateSlot(slotId, { trainer_id: null });
  }

  async deleteSlot(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/slots/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete slot');
  }

  async deleteSlotsByDate(date: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/slots?date=${date}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete slots');
  }
}
