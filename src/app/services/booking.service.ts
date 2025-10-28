import { Injectable } from '@angular/core';

export interface TimeSlot {
  time: string;
  available: boolean;
  id: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  driver: string;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private bookings: Booking[] = [];

  generateTimeSlots(): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 21;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: time,
          available: true,
          id: `slot-${time}`
        });
      }
    }

    return slots;
  }

  isSlotBooked(date: string, time: string): boolean {
    return this.bookings.some(b => b.date === date && b.time === time);
  }

  bookSlot(booking: Booking): void {
    this.bookings.push(booking);
  }

  getBookings(): Booking[] {
    return this.bookings;
  }
}
