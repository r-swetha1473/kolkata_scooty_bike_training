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
        <span *ngIf="toast.type === 'success'">✓</span>
        <span *ngIf="toast.type === 'error'">✕</span>
        <span *ngIf="toast.type === 'info'">ℹ</span>
        <span *ngIf="toast.type === 'warning'">⚠</span>
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
      background: #3b82f6;
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

