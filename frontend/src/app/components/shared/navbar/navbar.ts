import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
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
  mostrarDropdown: boolean = false;

  // Campos formulario
  nombre: string = '';
  email: string = '';
  currentPassword?: string = '';
  newPassword?: string = '';

  errorMsg: string = '';
  successMsg: string = '';
  guardando: boolean = false;

  constructor(private authService: AuthService, private router: Router, private eRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if(!this.eRef.nativeElement.contains(event.target)) {
      this.mostrarDropdown = false;
    }
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.mostrarDropdown = !this.mostrarDropdown;
  }

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
    this.mostrarDropdown = false;
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
        this.currentPassword = '';
        this.newPassword = '';
        this.guardando = false;
        
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: '¡Cuenta actualizada con éxito!',
          showConfirmButton: false,
          timer: 2500
        });

        // Cerrar modal automáticamente
        setTimeout(() => {
          this.cerrarMiCuenta();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al actualizar cuenta:', err);
        const errorMsg = err.error?.message || err.error || 'Ocurrió un error al actualizar tus datos.';
        this.guardando = false;

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMsg,
          confirmButtonColor: '#6c63ff'
        });
      }
    });
  }

  logout() {
    this.authService.logout();
  }
}
