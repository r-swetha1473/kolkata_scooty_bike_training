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
        <p class="footer-text">&copy; {{ currentYear }} Kolkata Scotty Bike Training. All rights reserved.</p>
      </div>
    </footer>
  `,
  styles: [`
    .admin-footer {
      background: var(--bg-white);
      margin-top: auto;
      border-top: 1px solid var(--border-light);
    }

    .footer-container {
      max-width: 100%;
      margin: 0 auto;
      padding: 20px 32px;
    }

    .footer-text {
      margin: 0;
      color: var(--text-muted);
      font-size: 13px;
      text-align: center;
    }

    @media (max-width: 768px) {
      .footer-container {
        padding: 16px;
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

