import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, UpdateUserRequest } from '../models/usuario.model';
import { environment } from '../../environtment/environtment.prod';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiUrl + '/api/auth';
  private usuarioSubject = new BehaviorSubject<AuthResponse | null>(null);
  usuario$ = this.usuarioSubject.asObservable();
  private mallaPendienteSubject = new BehaviorSubject<boolean>(false);
  mallaPendiente$ = this.mallaPendienteSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
    if (stored) {
      const user = JSON.parse(stored);
      this.usuarioSubject.next(user);
      this.mallaPendienteSubject.next(user.tutorialPendiente ?? false);
    }
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    // Al registrar manualmente, ahora devuelve un AuthResponse sin token porque requiere verificación
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data);
  }

  verifyEmail(email: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/verify-email`, { email, code }).pipe(
      tap(res => this.guardarSesion(res, true))
    );
  }

  login(data: LoginRequest, recordarme: boolean = false): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data).pipe(
      tap(res => this.guardarSesion(res, recordarme))
    );
  }

  actualizarCuenta(data: UpdateUserRequest): Observable<AuthResponse> {
    const usuariosUrl = environment.apiUrl + '/api/usuarios';
    return this.http.put<AuthResponse>(`${usuariosUrl}/cuenta`, data).pipe(
      tap(res => {
        // Maintain the same storage type that was previously used
        const useLocalStorage = !!localStorage.getItem('usuario');
        this.guardarSesion(res, useLocalStorage);
      })
    );
  }

  loginWithGoogle(token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/google`, { token }).pipe(
      tap(res => this.guardarSesion(res, true)) // Por defecto lo recordamos
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, { token, newPassword });
  }

  logout() {
    localStorage.removeItem('usuario');
    sessionStorage.removeItem('usuario');
    this.usuarioSubject.next(null);
    this.mallaPendienteSubject.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.usuarioSubject.value?.token ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.usuarioSubject.value;
  }

  getUsuario(): AuthResponse | null {
    return this.usuarioSubject.value;
  }

  isMallaPendiente(): boolean {
    return this.mallaPendienteSubject.value;
  }

  completarTutorial() {
    this.mallaPendienteSubject.next(false);
    const stored = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
    if (stored) {
      const user = JSON.parse(stored);
      user.tutorialPendiente = false;
      const dataStr = JSON.stringify(user);
      if (localStorage.getItem('usuario')) {
        localStorage.setItem('usuario', dataStr);
      } else {
        sessionStorage.setItem('usuario', dataStr);
      }
    }
  }

  private guardarSesion(res: AuthResponse, persistir: boolean = true) {
    const dataStr = JSON.stringify(res);
    if (persistir) {
      localStorage.setItem('usuario', dataStr);
      sessionStorage.removeItem('usuario');
    } else {
      sessionStorage.setItem('usuario', dataStr);
      localStorage.removeItem('usuario');
    }
    this.usuarioSubject.next(res);
    this.mallaPendienteSubject.next(res.tutorialPendiente ?? false);
  }
}