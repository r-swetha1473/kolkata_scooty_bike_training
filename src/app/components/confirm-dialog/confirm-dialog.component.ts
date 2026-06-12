import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService, ConfirmDialogConfig } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dialog-overlay" *ngIf="visible" (click)="onCancel()">
      <div
        class="dialog-card"
        [class]="'variant-' + (config?.variant || 'warning')"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()">
        <div class="dialog-icon" *ngIf="config?.variant === 'danger'">!</div>
        <div class="dialog-icon success" *ngIf="config?.variant === 'success'">✓</div>
        <div class="dialog-icon info" *ngIf="config?.variant === 'info'">i</div>
        <div class="dialog-icon" *ngIf="!config?.variant || config?.variant === 'warning'">?</div>
        <h3 class="dialog-title">{{ config?.title }}</h3>
        <p class="dialog-message">{{ config?.message }}</p>
        <div class="dialog-actions">
          <button type="button" class="btn-cancel" (click)="onCancel()">
            {{ config?.cancelLabel || 'Cancel' }}
          </button>
          <button
            type="button"
            class="btn-confirm"
            [class.danger]="config?.variant === 'danger'"
            (click)="onConfirm()">
            {{ config?.confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(17, 24, 39, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 16px;
      }
      .dialog-card {
        background: #fff;
        border-radius: 14px;
        padding: 24px;
        width: min(420px, 100%);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
        text-align: center;
      }
      .dialog-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #fef3c7;
        color: #b45309;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        font-weight: 700;
        margin: 0 auto 14px;
      }
      .dialog-icon.success {
        background: #d1fae5;
        color: #059669;
      }
      .dialog-icon.info {
        background: #dbeafe;
        color: #2563eb;
      }
      .variant-danger .dialog-icon {
        background: #fee2e2;
        color: #dc2626;
      }
      .dialog-title {
        margin: 0 0 8px;
        font-size: 20px;
        color: #111827;
      }
      .dialog-message {
        margin: 0 0 20px;
        color: #6b7280;
        line-height: 1.5;
        font-size: 14px;
      }
      .dialog-actions {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .btn-cancel,
      .btn-confirm {
        min-height: 42px;
        padding: 10px 18px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid #e5e7eb;
        font-size: 14px;
      }
      .btn-cancel {
        background: #f9fafb;
        color: #374151;
      }
      .btn-confirm {
        background: #0066b1;
        color: #fff;
        border-color: #0066b1;
      }
      .btn-confirm.danger {
        background: #dc2626;
        border-color: #dc2626;
      }
      @media (max-width: 480px) {
        .dialog-actions {
          flex-direction: column-reverse;
        }
        .dialog-actions button {
          width: 100%;
        }
      }
    `
  ]
})
export class ConfirmDialogComponent {
  visible = false;
  config: ConfirmDialogConfig | null = null;

  constructor(private dialog: ConfirmDialogService) {
    this.dialog.state$.subscribe((state) => {
      this.visible = state.visible;
      this.config = state.config;
    });
  }

  onConfirm(): void {
    this.dialog.accept();
  }

  onCancel(): void {
    this.dialog.dismiss();
  }
}
