import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

interface DialogState {
  visible: boolean;
  config: ConfirmDialogConfig | null;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private resolveFn: ((value: boolean) => void) | null = null;
  private readonly stateSubject = new BehaviorSubject<DialogState>({
    visible: false,
    config: null
  });

  readonly state$ = this.stateSubject.asObservable();

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolveFn = resolve;
      this.stateSubject.next({ visible: true, config });
    });
  }

  accept(): void {
    this.resolveFn?.(true);
    this.close();
  }

  dismiss(): void {
    this.resolveFn?.(false);
    this.close();
  }

  private close(): void {
    this.resolveFn = null;
    this.stateSubject.next({ visible: false, config: null });
  }
}
