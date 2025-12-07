import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

const API_BASE = (window as any).API_BASE || 'http://127.0.0.1:8000/api';

export interface AuthToken {
  access: string;
  refresh: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenSubject = new BehaviorSubject<string | null>(this.getToken());
  public token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {}

  private saveToken(token: AuthToken) {
    localStorage.setItem('authToken', JSON.stringify(token));
    this.tokenSubject.next(token.access);
  }

  getToken(): string | null {
    const token = localStorage.getItem('authToken');
    if (token) {
      return JSON.parse(token).access;
    }
    return null;
  }

  getCurrentUsername(): string | null {
    const token = this.getToken();
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        return decodedToken.username; // Assuming 'username' is in the token payload
      } catch (Error) {
        return null;
      }
    }
    return null;
  }

  login(credentials: any): Observable<AuthToken> {
    return this.http.post<AuthToken>(`${API_BASE}/auth/token/`, credentials).pipe(
      tap(token => this.saveToken(token))
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${API_BASE}/register/`, userData);
  }

  logout() {
    localStorage.removeItem('authToken');
    this.tokenSubject.next(null);
  }
}
