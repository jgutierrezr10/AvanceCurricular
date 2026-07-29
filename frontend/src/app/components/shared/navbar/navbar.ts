import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { UpdateUserRequest } from '../../../models/usuario.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit {
  nombreUsuario: string = '';
  mostrarModalCuenta: boolean = false;

  // Campos formulario
  nombre: string = '';
  email: string = '';
  currentPassword?: string = '';
  newPassword?: string = '';

  errorMsg: string = '';
  successMsg: string = '';
  guardando: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.cargarDatosUsuario();
  }

  cargarDatosUsuario() {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.nombreUsuario = usuario.nombre;
      this.nombre = usuario.nombre;
      this.email = usuario.email;
    }
  }

  abrirMiCuenta() {
    this.cargarDatosUsuario();
    this.errorMsg = '';
    this.successMsg = '';
    this.currentPassword = '';
    this.newPassword = '';
    this.mostrarModalCuenta = true;
  }

  cerrarMiCuenta() {
    this.mostrarModalCuenta = false;
  }

  actualizarCuenta() {
    this.errorMsg = '';
    this.successMsg = '';
    this.guardando = true;

    const request: UpdateUserRequest = {
      nombre: this.nombre,
      email: this.email,
      currentPassword: this.currentPassword || undefined,
      newPassword: this.newPassword || undefined
    };

    this.authService.actualizarCuenta(request).subscribe({
      next: (res) => {
        this.nombreUsuario = res.nombre;
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        this.successMsg = '¡Cuenta actualizada con éxito!';
        this.currentPassword = '';
        this.newPassword = '';
        this.guardando = false;
        // Cerrar modal automáticamente después de 1.5s
        setTimeout(() => {
          this.cerrarMiCuenta();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al actualizar cuenta:', err);
        this.errorMsg = err.error?.message || err.error || 'Ocurrió un error al actualizar tus datos.';
        this.guardando = false;
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
