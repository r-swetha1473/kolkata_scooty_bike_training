import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-slots-info',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="slots-info-page">
      <h1 class="title">Training slots</h1>
      <p class="lead">
        Slots are created automatically every night (default 12:00 AM Asia/Kolkata) for
        <strong>7 days</strong> starting today, with a default trainer hint in rotation. You do not need
        to create the grid manually each day.
      </p>
      <ul class="bullets">
        <li>Use <strong>Trainers</strong> to add or deactivate instructors (only active trainers appear to customers).</li>
        <li>Use <strong>Vehicles</strong> so per-slot capacities stay correct.</li>
        <li>Customers book on the public <a routerLink="/booking">booking page</a> and <strong>choose a trainer</strong>; the system assigns a training vehicle.</li>
      </ul>
      <p class="hint">Technical staff can still use API <code>/api/slots</code> for read-only inspection.</p>
    </div>
  `,
  styles: [
    `
      .slots-info-page {
        max-width: 720px;
        margin: 0 auto;
        padding: 8px 0 40px;
      }
      .title {
        font-size: 28px;
        font-weight: 700;
        color: var(--admin-text);
        margin: 0 0 16px;
      }
      .lead {
        font-size: 16px;
        line-height: 1.6;
        color: var(--admin-text-secondary);
        margin: 0 0 20px;
      }
      .bullets {
        margin: 0 0 20px;
        padding-left: 20px;
        color: var(--admin-text);
        line-height: 1.6;
      }
      .bullets a {
        color: var(--admin-primary);
        font-weight: 600;
      }
      .hint {
        font-size: 13px;
        color: var(--admin-text-muted);
      }
      code {
        font-size: 12px;
        background: var(--admin-bg-subtle);
        padding: 2px 6px;
        border-radius: 4px;
      }
    `
  ]
})
export class AdminSlotsInfoComponent {}
