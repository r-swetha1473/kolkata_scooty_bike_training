import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { SlotService, Slot } from '../../../services/slot.service';
import { HttpService } from '../../../services/http.service';
import { ToastService } from '../../../services/toast.service';
import { PermissionService } from '../../../services/permission.service';
import { getApiErrorMessage } from '../../../utils/api-error';
import { getKolkataToday, formatTimeToAMPM } from '../../../utils/date.utils';
import { getTotalAvailableSeats } from '../../../utils/vehicle.utils';
import { firstValueFrom } from 'rxjs';

interface VehicleOption {
  id: string;
  name: string;
  max_per_slot: number;
  is_active: boolean;
}

@Component({
  selector: 'app-admin-offline-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="offline-page">
      <div class="admin-page-header">
        <div>
          <h1 class="admin-page-title">Offline Bookings</h1>
          <p class="page-subtitle">Create walk-in bookings without customer login or Gmail</p>
        </div>
        <a routerLink="/admin/bookings" class="admin-btn admin-btn-secondary">View all bookings</a>
      </div>

      <div class="offline-grid" *ngIf="perms.can('bookings', 'create')">
        <section class="form-card">
          <h2>Create Booking</h2>
          <form (ngSubmit)="submitBooking()" class="offline-form">
            <div class="form-row">
              <div class="form-field">
                <label for="bookingDate">Date *</label>
                <input id="bookingDate" type="date" [(ngModel)]="selectedDate" name="selectedDate"
                  [min]="minDate" (change)="onDateChange()" class="admin-select full-width" required>
              </div>
              <div class="form-field">
                <label for="slotSelect">Slot *</label>
                <select id="slotSelect" [(ngModel)]="form.slot_id" name="slot_id" class="admin-select full-width"
                  (change)="onSlotChange()" required [disabled]="loadingSlots || !slots.length">
                  <option value="">{{ loadingSlots ? 'Loading slots…' : (slots.length ? 'Select slot' : 'No slots for this date') }}</option>
                  <option *ngFor="let slot of slots" [value]="slot.id">
                    {{ formatSlotLabel(slot) }}
                  </option>
                </select>
              </div>
            </div>

            <div class="customer-search-block">
              <div class="form-row">
                <div class="form-field">
                  <label for="searchPhone">Search Phone</label>
                  <input id="searchPhone" type="tel" [(ngModel)]="searchPhone" name="searchPhone"
                    class="admin-select full-width" maxlength="10" placeholder="10-digit mobile">
                </div>
                <div class="form-field">
                  <label for="searchName">Search Name</label>
                  <input id="searchName" type="text" [(ngModel)]="searchName" name="searchName"
                    class="admin-select full-width" placeholder="Customer name">
                </div>
                <div class="form-field search-actions">
                  <label>&nbsp;</label>
                  <button type="button" class="admin-btn admin-btn-secondary" (click)="searchCustomers()" [disabled]="searchingCustomers">
                    {{ searchingCustomers ? 'Searching…' : 'Search Customer' }}
                  </button>
                </div>
              </div>

              <div class="match-card" *ngIf="customerMatches.length">
                <strong>Existing Customer Found</strong>
                <div class="match-item" *ngFor="let match of customerMatches">
                  <div>
                    <div>{{ match.customer_name }}</div>
                    <div class="match-meta">{{ match.phone || 'No phone' }} · {{ match.source === 'profile' ? 'Registered user' : 'Previous offline booking' }}</div>
                  </div>
                  <div class="match-actions">
                    <button type="button" class="admin-btn admin-btn-primary" (click)="reuseCustomer(match)">Reuse</button>
                  </div>
                </div>
                <button type="button" class="link-btn" (click)="clearCustomerSearch()">Create new customer anyway</button>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label for="vehicleSelect">Vehicle *</label>
                <select id="vehicleSelect" [(ngModel)]="form.vehicle_id" name="vehicle_id" class="admin-select full-width" required>
                  <option value="">Select vehicle</option>
                  <option *ngFor="let v of vehicles" [value]="v.id">{{ v.name }}</option>
                </select>
              </div>
              <div class="form-field">
                <label for="customerName">Customer Name *</label>
                <input id="customerName" type="text" [(ngModel)]="form.customer_name" name="customer_name"
                  class="admin-select full-width" maxlength="120" required placeholder="Walk-in customer name">
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label for="customerPhone">Phone</label>
                <input id="customerPhone" type="tel" [(ngModel)]="form.phone" name="phone"
                  class="admin-select full-width" maxlength="10" placeholder="10-digit mobile (optional)">
              </div>
              <div class="form-field">
                <label for="customerAge">Age</label>
                <input id="customerAge" type="number" [(ngModel)]="form.age" name="age"
                  class="admin-select full-width" min="1" max="120" placeholder="Optional">
              </div>
              <div class="form-field">
                <label for="customerGender">Gender</label>
                <select id="customerGender" [(ngModel)]="form.gender" name="gender" class="admin-select full-width">
                  <option value="">Optional</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div class="form-field">
              <label for="notes">Notes</label>
              <textarea id="notes" [(ngModel)]="form.notes" name="notes" rows="3"
                class="admin-select full-width" maxlength="1000" placeholder="Optional notes"></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="admin-btn admin-btn-secondary" (click)="resetForm()" [disabled]="submitting">Reset</button>
              <button type="submit" class="admin-btn admin-btn-primary" [disabled]="submitting || !canSubmit()">
                {{ submitting ? 'Creating…' : 'Create Offline Booking' }}
              </button>
            </div>
          </form>
        </section>

        <section class="recent-card">
          <div class="recent-head">
            <h2>Recent Offline Bookings</h2>
            <button type="button" class="admin-btn admin-btn-secondary" (click)="loadRecent()" [disabled]="loadingRecent">Refresh</button>
          </div>
          <p *ngIf="loadingRecent" class="loading-hint">Loading…</p>
          <div class="recent-list" *ngIf="!loadingRecent && recentBookings.length">
            <article class="recent-item" *ngFor="let b of recentBookings">
              <div class="recent-top">
                <strong>{{ b.offline_reference_number || b.offline_customer_name || 'Customer' }}</strong>
                <span class="source-pill offline">OFFLINE</span>
              </div>
              <div class="recent-meta">
                <span>{{ b.offline_customer_name }}</span>
                <span>{{ formatDateTime(b.start_time || b.slot?.start_time) }}</span>
                <span>{{ b.vehicle_name || 'Vehicle' }}</span>
                <span class="status-badge" [class]="'status-' + b.status">{{ b.status }}</span>
              </div>
              <div class="recent-by" *ngIf="getCreatedByLabel(b)">Created by {{ getCreatedByLabel(b) }}</div>
            </article>
          </div>
          <p *ngIf="!loadingRecent && !recentBookings.length" class="empty-hint">No offline bookings yet.</p>
        </section>
      </div>

      <p *ngIf="!perms.can('bookings', 'create')" class="empty-hint">
        You do not have permission to create offline bookings.
      </p>
    </div>
  `,
  styles: [`
    .offline-page { max-width: 1200px; }
    .page-subtitle { margin: 6px 0 0; color: #6b7280; font-size: 14px; }
    .admin-page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }
    .offline-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
      align-items: start;
    }
    .form-card, .recent-card {
      background: #fff;
      border: 1px solid var(--admin-border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: var(--admin-shadow-sm);
    }
    .form-card h2, .recent-card h2 { margin: 0 0 16px; font-size: 18px; }
    .offline-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }
    .form-field label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }
    .full-width { width: 100%; box-sizing: border-box; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 8px;
    }
    .recent-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .recent-head h2 { margin: 0; }
    .recent-list { display: flex; flex-direction: column; gap: 12px; }
    .recent-item {
      border: 1px solid var(--admin-border);
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
    }
    .recent-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .source-pill {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1e40af;
    }
    .source-pill.offline {
      background: #ffedd5;
      color: #9a3412;
    }
    .customer-search-block {
      padding: 12px;
      border: 1px dashed var(--admin-border);
      border-radius: 10px;
      background: #fafafa;
    }
    .search-actions { display: flex; flex-direction: column; justify-content: flex-end; }
    .match-card {
      margin-top: 12px;
      padding: 12px;
      border-radius: 10px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
    }
    .match-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-top: 1px solid #ffedd5;
    }
    .match-item:first-of-type { border-top: none; }
    .match-meta { font-size: 12px; color: #6b7280; }
    .match-actions { flex-shrink: 0; }
    .link-btn {
      margin-top: 8px;
      border: none;
      background: transparent;
      color: var(--admin-primary, #0066B1);
      cursor: pointer;
      font-size: 13px;
      padding: 0;
    }
    .recent-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-top: 8px;
      font-size: 13px;
      color: #4b5563;
    }
    .recent-by { margin-top: 6px; font-size: 12px; color: #6b7280; }
    .loading-hint, .empty-hint { color: #6b7280; font-size: 14px; }
    @media (max-width: 900px) {
      .offline-grid { grid-template-columns: 1fr; }
      .admin-page-header { flex-direction: column; }
    }
  `]
})
export class AdminOfflineBookingsComponent implements OnInit {
  selectedDate = getKolkataToday();
  minDate = getKolkataToday();
  slots: Slot[] = [];
  vehicles: VehicleOption[] = [];
  loadingSlots = false;
  loadingRecent = false;
  submitting = false;
  recentBookings: any[] = [];
  searchPhone = '';
  searchName = '';
  searchingCustomers = false;
  customerMatches: any[] = [];
  reuseUserId: string | null = null;

  form = {
    slot_id: '',
    vehicle_id: '',
    customer_name: '',
    phone: '',
    age: '' as string | number,
    gender: '',
    notes: ''
  };

  constructor(
    private adminService: AdminService,
    private slotService: SlotService,
    private http: HttpService,
    private toastService: ToastService,
    public perms: PermissionService
  ) {}

  async ngOnInit() {
    await Promise.all([this.loadVehicles(), this.onDateChange(), this.loadRecent()]);
  }

  async loadVehicles() {
    try {
      this.vehicles = await firstValueFrom(this.http.get<VehicleOption[]>('/vehicles'));
    } catch {
      this.vehicles = [];
    }
  }

  async onDateChange() {
    if (!this.selectedDate) return;
    this.loadingSlots = true;
    this.form.slot_id = '';
    try {
      this.slots = await this.slotService.getSlotsByDate(this.selectedDate);
    } catch (err) {
      this.slots = [];
      this.toastService.error(getApiErrorMessage(err, 'Failed to load slots'));
    } finally {
      this.loadingSlots = false;
    }
  }

  onSlotChange() {}

  formatSlotLabel(slot: Slot): string {
    const time = slot.start_time ? formatTimeToAMPM(slot.start_time) : 'Time TBD';
    const available = getTotalAvailableSeats(slot);
    return `${time} · ${available} seat(s) available`;
  }

  canSubmit(): boolean {
    return !!(this.form.slot_id && this.form.vehicle_id && this.form.customer_name.trim());
  }

  resetForm() {
    this.form = {
      slot_id: '',
      vehicle_id: '',
      customer_name: '',
      phone: '',
      age: '',
      gender: '',
      notes: ''
    };
    this.reuseUserId = null;
    this.customerMatches = [];
    this.searchPhone = '';
    this.searchName = '';
  }

  async searchCustomers() {
    const phone = this.searchPhone.trim();
    const name = this.searchName.trim();
    if (!phone && !name) {
      this.toastService.error('Enter a phone number or customer name to search');
      return;
    }
    this.searchingCustomers = true;
    try {
      this.customerMatches = await this.adminService.searchOfflineCustomers({ phone, name });
      if (!this.customerMatches.length) {
        this.toastService.success('No existing customer found — you can create a new one');
      }
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Customer search failed'));
    } finally {
      this.searchingCustomers = false;
    }
  }

  reuseCustomer(match: any) {
    this.form.customer_name = match.customer_name || '';
    this.form.phone = match.phone ? String(match.phone).replace(/\D/g, '').slice(-10) : '';
    this.reuseUserId = match.user_id || null;
    this.toastService.success('Customer details loaded');
  }

  clearCustomerSearch() {
    this.customerMatches = [];
    this.reuseUserId = null;
  }

  async submitBooking() {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;
    try {
      const payload: Record<string, unknown> = {
        slot_id: this.form.slot_id,
        vehicle_id: this.form.vehicle_id,
        customer_name: this.form.customer_name.trim()
      };
      if (this.form.phone.trim()) payload['phone'] = this.form.phone.trim();
      if (this.form.age !== '' && this.form.age != null) payload['age'] = Number(this.form.age);
      if (this.form.gender.trim()) payload['gender'] = this.form.gender.trim();
      if (this.form.notes.trim()) payload['notes'] = this.form.notes.trim();
      if (this.reuseUserId) payload['reuse_user_id'] = this.reuseUserId;

      const created = await this.adminService.createOfflineBooking(payload);
      this.toastService.success(`Offline booking ${created.offline_reference_number || ''} created`.trim());
      this.resetForm();
      await Promise.all([this.onDateChange(), this.loadRecent()]);
    } catch (err) {
      this.toastService.error(getApiErrorMessage(err, 'Failed to create offline booking'));
    } finally {
      this.submitting = false;
    }
  }

  async loadRecent() {
    this.loadingRecent = true;
    try {
      const res = await this.adminService.getAllBookings({
        source: 'OFFLINE',
        limit: 8,
        offset: 0
      });
      this.recentBookings = res.bookings;
    } catch {
      this.recentBookings = [];
    } finally {
      this.loadingRecent = false;
    }
  }

  getCreatedByLabel(booking: any): string {
    if (booking.booking_source !== 'OFFLINE') return '';
    const name = booking.created_by_admin_name;
    if (!name) return 'Admin';
    const role = booking.created_by_admin_role;
    if (role === 'subadmin') return `${name} (Sub Admin)`;
    if (role === 'superadmin') return `${name} (Super Admin)`;
    return name;
  }

  formatDateTime(value?: string): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  }
}
