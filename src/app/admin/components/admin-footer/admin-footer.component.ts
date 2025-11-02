import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="admin-footer">
      <div class="footer-container">
        <div class="footer-content">
          <div class="footer-section">
            <h4>Admin Panel</h4>
            <p>Kolkata Scotty Bike Training Management System</p>
          </div>
          
          <div class="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a routerLink="/admin" routerLinkActive="active">Dashboard</a></li>
              <li><a routerLink="/admin/bookings" routerLinkActive="active">Bookings</a></li>
              <li><a routerLink="/admin/trainers" routerLinkActive="active">Trainers</a></li>
            </ul>
          </div>

          <div class="footer-section">
            <h4>Support</h4>
            <ul>
              <li><a href="mailto:support@kolkatascotty.com">Support Email</a></li>
              <li><a href="tel:+919876543210">Phone: +91 98765 43210</a></li>
            </ul>
          </div>

          <div class="footer-section">
            <h4>System Info</h4>
            <ul>
              <li>Version: 1.0.0</li>
              <li>Environment: {{ environment }}</li>
              <li>Last Updated: {{ currentYear }}</li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <p>&copy; {{ currentYear }} Kolkata Scotty Bike Training. All rights reserved.</p>
          <p class="footer-note">Administrative Access Only - Confidential</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .admin-footer {
      background: #1f2937;
      color: #e5e7eb;
      margin-top: auto;
      border-top: 1px solid #374151;
    }

    .footer-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 40px 32px 20px;
    }

    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 32px;
      margin-bottom: 32px;
    }

    .footer-section h4 {
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .footer-section p {
      color: #9ca3af;
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
    }

    .footer-section ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .footer-section ul li {
      margin-bottom: 10px;
      color: #9ca3af;
      font-size: 14px;
    }

    .footer-section ul li a {
      color: #9ca3af;
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-section ul li a:hover {
      color: #ffffff;
    }

    .footer-bottom {
      padding-top: 24px;
      border-top: 1px solid #374151;
      text-align: center;
    }

    .footer-bottom p {
      margin: 8px 0;
      color: #9ca3af;
      font-size: 14px;
    }

    .footer-note {
      font-size: 12px !important;
      color: #6b7280 !important;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .footer-container {
        padding: 32px 16px 16px;
      }

      .footer-content {
        grid-template-columns: 1fr;
        gap: 24px;
      }

      .footer-bottom {
        text-align: left;
      }
    }
  `]
})
export class AdminFooterComponent {
  currentYear = new Date().getFullYear();
  environment = 'Production'; // You can make this dynamic based on your environment config

  constructor() {
    // You can check environment here
    // this.environment = isDevMode() ? 'Development' : 'Production';
  }
}

