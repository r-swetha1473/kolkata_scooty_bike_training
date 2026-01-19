import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-login-page">
      <div class="login-container">
        <div class="login-card">
          <div class="logo-section">
            <div class="logo-icon">🏍️</div>
            <h1>Admin Login</h1>
            <p class="subtitle">Kolkata Scotty Management Portal</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                type="email"
                id="email"
                [(ngModel)]="credentials.email"
                name="email"
                placeholder="admin@kolkatascotty.com"
                required
                [disabled]="loading"
                autocomplete="email">
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                [(ngModel)]="credentials.password"
                name="password"
                placeholder="Enter your password"
                required
                [disabled]="loading"
                autocomplete="current-password">
            </div>

            <div class="error-message" *ngIf="errorMessage">
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              class="btn-login"
              [disabled]="loading || !credentials.email || !credentials.password">
              <span *ngIf="!loading">Sign In</span>
              <span *ngIf="loading">Signing in...</span>
            </button>
          </form>

          <div class="info-message">
            <p>Admin access only. For customer bookings, use the main site.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      padding: 20px;
    }

    .login-container {
      width: 100%;
      max-width: 420px;
    }

    .login-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-primary);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-xl);
      padding: 40px;
      animation: slideUp 0.4s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .logo-section {
      text-align: center;
      margin-bottom: 40px;
    }

    .logo-icon {
      font-size: 60px;
      margin-bottom: 16px;
      animation: bounce 2s infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      color: var(--text-primary);
      font-weight: 700;
    }

    .subtitle {
      margin: 0;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 14px;
    }

    input {
      padding: 12px 16px;
      border: 2px solid var(--border-primary);
      border-radius: var(--border-radius-md);
      font-size: 15px;
      transition: all var(--transition-base);
      outline: none;
    }

    input:focus {
      border-color: var(--border-accent);
      box-shadow: var(--shadow-focus);
    }

    input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      border: 1px solid #fcc;
    }

    .btn-login {
      padding: 14px 24px;
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 10px;
    }

    .btn-login:hover:not(:disabled) {
      background: #c0392b;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
    }

    .btn-login:disabled {
      background: #bdc3c7;
      cursor: not-allowed;
      transform: none;
    }

    .info-message {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--border-primary);
      text-align: center;
    }

    .info-message p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 13px;
    }

    @media (max-width: 480px) {
      .login-card {
        padding: 30px 20px;
      }

      h1 {
        font-size: 24px;
      }

      .logo-icon {
        font-size: 50px;
      }
    }
  `]
})
export class AdminLoginComponent {
  credentials = {
    email: '',
    password: ''
  };

  loading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.signInWithEmailPassword(
        this.credentials.email,
        this.credentials.password
      );

      const profile = this.authService.getUserProfile();
      if (profile && (profile.role === 'admin' || profile.role === 'superadmin')) {
        this.router.navigate(['/admin']);
      } else {
        this.errorMessage = 'Access denied. Admin credentials required.';
        await this.authService.signOut();
      }
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage = error.message || 'Invalid email or password';
    } finally {
      this.loading = false;
    }
  }
}
