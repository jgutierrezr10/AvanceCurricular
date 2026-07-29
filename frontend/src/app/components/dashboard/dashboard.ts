import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Navbar } from '../shared/navbar/navbar';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, Navbar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  nombreUsuario = '';

  // Datos Simulados
  estadisticas = {
    ramosInscritos: 8,
    promedioGeneral: 6.2,
    diasRacha: 18,
    tareasPendientes: 4
  };

  proximaClase = {
    ramo: 'Estructuras de Datos',
    horario: 'Hoy, 10:00 AM – 11:30 AM',
    sala: 'Sala B203'
  };

  progresoMalla = 61;
  promedioActual = '6.2 / 7.0';
  proximaEntrega = {
    nombre: 'Informe Laboratorio 2',
    fecha: '24 May 2025'
  };

  tareasPendientesList = [
    { id: 1, nombre: 'Informe Laboratorio 2', ramo: 'Estructuras de Datos', fecha: '24 May' },
    { id: 2, nombre: 'Ejercicios Capítulo 5', ramo: 'Matemáticas Discretas', fecha: '26 May' },
    { id: 3, nombre: 'Presentación Grupo 3', ramo: 'Ingeniería de Software', fecha: '28 May' },
    { id: 4, nombre: 'Quiz Algoritmos', ramo: 'Algoritmos y Programación', fecha: '30 May' }
  ];

  eventosProximos = [
    { id: 1, titulo: 'Prueba 2 - Estructuras de Datos', fecha: '28 May 2025', hora: '10:00 AM', color: 'pink' },
    { id: 2, titulo: 'Tutoría de Álgebra', fecha: '30 May 2025', hora: '04:00 PM', color: 'blue' },
    { id: 3, titulo: 'Entrega Proyecto 1', fecha: '02 Jun 2025', hora: '11:59 PM', color: 'green' }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit() {
    const usuario = this.authService.getUsuario();
    if (usuario && usuario.nombre) {
      this.nombreUsuario = usuario.nombre;
    } else {
      this.nombreUsuario = 'Estudiante';
    }
  }

  logout() {
    this.authService.logout();
  }
}
