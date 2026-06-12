import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { HttpService } from './http.service';
import { firstValueFrom } from 'rxjs';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
  is_read?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private openPanelSubject = new Subject<void>();
  unreadCount$ = this.unreadCountSubject.asObservable();
  openPanel$ = this.openPanelSubject.asObservable();

  constructor(private http: HttpService) {}

  requestOpenPanel(): void {
    this.openPanelSubject.next();
  }

  async refreshUnreadCount(): Promise<number> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ count: number }>('/admin/notifications/unread-count')
      );
      const count = res?.count ?? 0;
      this.unreadCountSubject.next(count);
      return count;
    } catch {
      this.unreadCountSubject.next(0);
      return 0;
    }
  }

  async listNotifications(options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<{ notifications: AdminNotification[]; total: number; unreadCount: number }> {
    const params = new URLSearchParams();
    if (options?.limit != null) params.set('limit', String(options.limit));
    if (options?.offset != null) params.set('offset', String(options.offset));
    if (options?.unreadOnly) params.set('unreadOnly', 'true');
    const qs = params.toString();
    const res = await firstValueFrom(
      this.http.get<{
        notifications: AdminNotification[];
        total: number;
        unreadCount: number;
      }>(`/admin/notifications${qs ? `?${qs}` : ''}`)
    );
    this.unreadCountSubject.next(res?.unreadCount ?? 0);
    return {
      notifications: res?.notifications ?? [],
      total: res?.total ?? 0,
      unreadCount: res?.unreadCount ?? 0
    };
  }

  async markRead(notificationId: string): Promise<void> {
    await firstValueFrom(this.http.put(`/admin/notifications/${notificationId}/read`, {}));
    await this.refreshUnreadCount();
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.http.put('/admin/notifications/read-all', {}));
    this.unreadCountSubject.next(0);
  }
}
