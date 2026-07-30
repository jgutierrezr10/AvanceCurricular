import { Component, ChangeDetectorRef, OnInit, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environtment/environtment.prod';
import Swal from 'sweetalert2';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit {
  email = '';
  password = '';
  recordarme = false;
  error = '';
  cargando = false;
  mostrarPassword = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    this.renderGoogleButton();
  }

  renderGoogleButton() {
    if (typeof google === 'undefined') {
      setTimeout(() => this.renderGoogleButton(), 500);
      return;
    }
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: this.handleGoogleResponse.bind(this)
    });
    google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      { theme: 'outline', size: 'large', width: 350 } // El ancho en píxeles
    );
  }

  handleGoogleResponse(response: any) {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();
    
    this.authService.loginWithGoogle(response.credential).subscribe({
      next: (res) => {
        if (res.nuevoUsuario) {
          // Es un usuario nuevo: pedirle nombre y contraseña
          this.cargando = false;
          this.cdr.detectChanges();
          Swal.fire({
            title: '<span style="font-size: 26px; font-weight: 800; color: #1e1e2d; letter-spacing: -0.5px;">¡Bienvenido a AULA!</span>',
            html: `
              <div style="text-align: center; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(72, 198, 239, 0.1)); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; border: 1px solid rgba(108, 99, 255, 0.2);">
                  <svg style="width: 40px; height: 40px; color: #6C63FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                </div>
                <p style="color: #64748b; font-size: 15px; margin: 0; line-height: 1.6;">Para completar tu registro, elige un nombre de usuario y contraseña. Así también podrás entrar sin depender de Google.</p>
              </div>
              <div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">
                <div style="width: 100%; text-align: left;">
                  <label style="font-size: 13px; font-weight: 700; color: #475569; margin-left: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre de usuario</label>
                  <input type="text" id="nuevo-nombre" class="swal2-input" placeholder="Ej: Juan Perez" maxlength="30" style="margin-top: 8px; border-radius: 12px; font-size: 15px; width: 100%; box-sizing: border-box; background: #f8fafc; border: 2px solid transparent; transition: all 0.3s;">
                </div>
                <div style="width: 100%; text-align: left;">
                  <label style="font-size: 13px; font-weight: 700; color: #475569; margin-left: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Contraseña</label>
                  <input type="password" id="nuevo-pass" class="swal2-input" placeholder="Mínimo 6 caracteres" style="margin-top: 8px; border-radius: 12px; font-size: 15px; width: 100%; box-sizing: border-box; background: #f8fafc; border: 2px solid transparent; transition: all 0.3s;">
                </div>
              </div>
            `,
            confirmButtonText: 'Guardar y Entrar',
            confirmButtonColor: '#6C63FF',
            allowOutsideClick: false,
            customClass: {
              confirmButton: 'rounded-button',
              popup: 'modern-popup'
            },
            preConfirm: () => {
              const nombre = (document.getElementById('nuevo-nombre') as HTMLInputElement).value.trim();
              const pass = (document.getElementById('nuevo-pass') as HTMLInputElement).value;
              if (!nombre) { Swal.showValidationMessage('El nombre de usuario es obligatorio'); return false; }
              if (nombre.length < 3) { Swal.showValidationMessage('El nombre debe tener al menos 3 caracteres'); return false; }
              if (!pass || pass.length < 6) { Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres'); return false; }
              return this.authService.actualizarCuenta({ nombre, newPassword: pass }).toPromise().catch(err => {
                Swal.showValidationMessage(err.error?.message || 'Error al guardar los datos');
              });
            }
          }).then((result) => {
            if (result.isConfirmed) {
              this.ngZone.run(() => {
                if (result.value?.tutorialPendiente) {
                  this.router.navigate(['/malla'], { queryParams: { tutorial: 'true' } });
                } else {
                  this.router.navigate(['/dashboard']);
                }
              });
            }
          });
        } else {
          this.ngZone.run(() => {
            if (res.tutorialPendiente) {
              this.router.navigate(['/malla'], { queryParams: { tutorial: 'true' } });
            } else {
              this.router.navigate(['/dashboard']);
            }
          });
        }
      },
      error: (err) => {
        this.error = 'Error al iniciar sesión con Google';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  login() {
    // Validaciones
    if (!this.email.trim()) {
      this.error = 'Ingresa tu email o nombre de usuario';
      return;
    }
    // Si ingresó algo con @, asumimos que es correo y lo validamos
    if (this.email.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email.trim())) {
        this.error = 'Ingresa un formato de correo válido';
        return;
      }
    }
    if (!this.password) {
      this.error = 'Ingresa tu contraseña';
      return;
    }

    this.error = '';
    this.cargando = true;
    this.authService.login({ email: this.email.trim(), password: this.password }, this.recordarme).subscribe({
      next: (res) => {
        if (res.tutorialPendiente) {
          this.router.navigate(['/malla'], { queryParams: { tutorial: 'true' } });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        if (err && err.error && err.error.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Email o contraseña incorrectos';
        }
        this.cargando = false;
        this.cdr.detectChanges(); // Forzar actualización de la UI
      }
    });
  }

  recuperarPassword() {
    Swal.fire({
      title: '<span style="font-size: 26px; font-weight: 700; color: #333;">Recuperar Contraseña</span>',
      html: `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="background: #EEEDFF; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            <svg style="width: 40px; height: 40px; color: #6C63FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          </div>
          <p style="color: #666; font-size: 16px; margin: 0; line-height: 1.5;">Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un código para restablecer tu acceso.</p>
        </div>
        <input type="email" id="forgot-email" class="swal2-input" placeholder="Ingresa tu correo: tu@email.com" style="border-radius: 12px; font-size: 16px; padding: 15px; width: 85%; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      `,
      showCancelButton: true,
      confirmButtonText: 'Enviar Código',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6C63FF',
      cancelButtonColor: '#d33',
      customClass: {
        confirmButton: 'rounded-button',
        cancelButton: 'rounded-button',
        popup: 'modern-popup'
      },
      showLoaderOnConfirm: true,
      preConfirm: () => {
        const emailStr = (document.getElementById('forgot-email') as HTMLInputElement).value.trim();
        if (!emailStr) {
          Swal.showValidationMessage('El correo es obligatorio');
          return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailStr)) {
          Swal.showValidationMessage('Por favor ingresa un correo válido');
          return false;
        }
        return this.authService.forgotPassword(emailStr).toPromise().catch(err => {
          Swal.showValidationMessage(err.error?.message || 'Error al solicitar recuperación');
        });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: '<span style="font-size: 26px; font-weight: 700; color: #333;">Código Enviado</span>',
          html: `
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="background: #E8F5E9; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
                <svg style="width: 40px; height: 40px; color: #4CAF50;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <p style="color: #666; font-size: 15px; margin: 0; line-height: 1.5;">Revisa tu bandeja de entrada o spam. Ingresa el código recibido junto con tu nueva contraseña.</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
              <div style="width: 90%; text-align: left;">
                <label style="font-size: 14px; font-weight: 600; color: #555; margin-left: 5px;">Código de recuperación</label>
                <input type="text" id="reset-token" class="swal2-input" placeholder="Pega el código aquí..." style="margin-top: 8px; border-radius: 12px; font-size: 15px; width: 100%; box-sizing: border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              </div>
              <div style="width: 90%; text-align: left;">
                <label style="font-size: 14px; font-weight: 600; color: #555; margin-left: 5px;">Nueva Contraseña</label>
                <input type="password" id="reset-pass" class="swal2-input" placeholder="••••••••" style="margin-top: 8px; border-radius: 12px; font-size: 15px; width: 100%; box-sizing: border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
              </div>
            </div>
          `,
          confirmButtonText: 'Actualizar Contraseña',
          confirmButtonColor: '#6C63FF',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
          cancelButtonColor: '#d33',
          customClass: {
            confirmButton: 'rounded-button',
            cancelButton: 'rounded-button',
            popup: 'modern-popup'
          },
          showLoaderOnConfirm: true,
          preConfirm: () => {
            const token = (document.getElementById('reset-token') as HTMLInputElement).value.trim();
            const newPass = (document.getElementById('reset-pass') as HTMLInputElement).value;
            if (!token || !newPass) {
              Swal.showValidationMessage('Debes ingresar el código y la nueva contraseña');
              return false;
            }
            if (newPass.length < 6) {
              Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres');
              return false;
            }
            return this.authService.resetPassword(token, newPass).toPromise().catch(err => {
              Swal.showValidationMessage(err.error?.message || 'El código es inválido o ha expirado');
            });
          }
        }).then((resetResult) => {
          if (resetResult.isConfirmed) {
            Swal.fire({
              title: '<span style="font-size: 26px; font-weight: 700; color: #333;">¡Todo listo!</span>',
              html: `
                <div style="text-align: center; margin-bottom: 10px;">
                  <div style="background: #E8F5E9; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; animation: pulse 2s infinite;">
                    <svg style="width: 40px; height: 40px; color: #4CAF50;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <p style="color: #666; font-size: 16px;">Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con tu nueva clave.</p>
                </div>
              `,
              confirmButtonText: 'Ir a Iniciar Sesión',
              confirmButtonColor: '#6C63FF',
              customClass: {
                confirmButton: 'rounded-button',
                popup: 'modern-popup'
              }
            });
          }
        });
      }
    });
  }

}