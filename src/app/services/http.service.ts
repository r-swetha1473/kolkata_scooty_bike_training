import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { getAuthToken } from '../utils/auth-token.storage';

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    });
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, {
      headers: this.getHeaders(),
      withCredentials: true
    });
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    if (endpoint.replace(/^\//, '') === 'bookings') {
      const token = getAuthToken();
      console.log('[HttpService] POST /bookings', {
        body: { ...data, notes: data?.notes ? '[set]' : data?.notes },
        hasBearerToken: !!token,
        authorizationPreview: token ? 'Bearer ***' + token.slice(-8) : '(none — cookie auth may apply)'
      });
    }
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getHeaders(),
      withCredentials: true
    });
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${endpoint}`, data, {
      headers: this.getHeaders(),
      withCredentials: true
    });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${endpoint}`, {
      headers: this.getHeaders(),
      withCredentials: true
    });
  }
}
