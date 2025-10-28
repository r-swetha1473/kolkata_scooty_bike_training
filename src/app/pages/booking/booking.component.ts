import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService, TimeSlot } from '../../services/booking.service';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css']
})
export class BookingComponent implements OnInit {
  timeSlots: TimeSlot[] = [];
  selectedDate: string = '';
  selectedSlot: TimeSlot | null = null;
  showBookingModal = false;
  showDriverModal = false;
  showConfirmation = false;

  bookingForm = {
    name: '',
    phone: '',
    date: '',
    time: '',
    driver: ''
  };

  drivers = [
    { id: 1, name: 'Rajesh Kumar', avatar: '👨‍🏫', rating: 4.9, experience: '12 Years' },
    { id: 2, name: 'Anita Sharma', avatar: '👩‍🏫', rating: 4.8, experience: '10 Years' },
    { id: 3, name: 'Vikram Singh', avatar: '👨‍🏫', rating: 5.0, experience: '15 Years' },
    { id: 4, name: 'Priya Banerjee', avatar: '👩‍🏫', rating: 4.9, experience: '8 Years' }
  ];

  selectedDriver: any = null;

  constructor(private bookingService: BookingService) {}

  ngOnInit() {
    this.timeSlots = this.bookingService.generateTimeSlots();
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    this.updateSlotAvailability();
  }

  onDateChange() {
    this.updateSlotAvailability();
  }

  updateSlotAvailability() {
    this.timeSlots = this.timeSlots.map(slot => ({
      ...slot,
      available: !this.bookingService.isSlotBooked(this.selectedDate, slot.time)
    }));
  }

  selectSlot(slot: TimeSlot) {
    if (slot.available) {
      this.selectedSlot = slot;
      this.bookingForm.date = this.selectedDate;
      this.bookingForm.time = slot.time;
      this.showBookingModal = true;
    }
  }

  closeBookingModal() {
    this.showBookingModal = false;
    this.selectedSlot = null;
    this.resetForm();
  }

  openDriverModal() {
    if (this.bookingForm.name && this.bookingForm.phone) {
      this.showDriverModal = true;
    }
  }

  closeDriverModal() {
    this.showDriverModal = false;
  }

  selectDriver(driver: any) {
    this.selectedDriver = driver;
    this.bookingForm.driver = driver.name;
    this.closeDriverModal();
  }

  confirmBooking() {
    if (this.bookingForm.name && this.bookingForm.phone && this.bookingForm.driver) {
      const booking = {
        id: Date.now().toString(),
        name: this.bookingForm.name,
        phone: this.bookingForm.phone,
        date: this.bookingForm.date,
        time: this.bookingForm.time,
        driver: this.bookingForm.driver
      };

      this.bookingService.bookSlot(booking);
      this.updateSlotAvailability();

      this.closeBookingModal();
      this.showConfirmation = true;

      setTimeout(() => {
        this.showConfirmation = false;
      }, 4000);
    }
  }

  resetForm() {
    this.bookingForm = {
      name: '',
      phone: '',
      date: '',
      time: '',
      driver: ''
    };
    this.selectedDriver = null;
  }

  getMinDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
