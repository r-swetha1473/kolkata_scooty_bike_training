import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="toast" class="toast" [class]="'toast-' + toast.type" [class.show]="show">
      <span class="toast-icon">
        <svg *ngIf="toast.type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <svg *ngIf="toast.type === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <svg *ngIf="toast.type === 'info'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <svg *ngIf="toast.type === 'warning'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </span>
      <span class="toast-message">{{ toast.message }}</span>
      <button class="toast-close" (click)="close()">×</button>
    </div>
  `,
  styles: [`
    .toast {
      position: fixed;
      bottom: -100px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      transition: bottom 0.3s ease-in-out;
      z-index: 10000;
      max-width: 90%;
      min-width: 300px;
      font-weight: 600;
      font-size: 14px;
      color: white;
    }

    .toast.show {
      bottom: 30px;
    }

    .toast-success {
      background: #16a34a;
    }

    .toast-error {
      background: #dc2626;
    }

    .toast-info {
      background: var(--primary-blue);
    }

    .toast-warning {
      background: #f59e0b;
    }

    .toast-icon {
      font-size: 20px;
      font-weight: bold;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
    }

    .toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      opacity: 0.8;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @media (max-width: 768px) {
      .toast {
        min-width: auto;
        width: calc(100% - 40px);
        left: 20px;
        transform: none;
      }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toast: ToastMessage | null = null;
  show = false;
  private subscription?: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.subscription = this.toastService.toast$.subscribe(toast => {
      if (toast) {
        this.toast = toast;
        setTimeout(() => this.show = true, 10);
      } else {
        this.show = false;
        setTimeout(() => this.toast = null, 300);
      }
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  close() {
    this.toastService.hide();
  }
}

