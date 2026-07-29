import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Navbar } from '../shared/navbar/navbar';
import { RamoService } from '../../services/ramo.service';
import { HorarioService, BloqueHorarioDTO } from '../../services/horario.service';
import { EvaluacionService } from '../../services/evaluacion.service';
import { Ramo } from '../../models/ramo.model';
import { Evaluacion } from '../../models/evaluacion.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, Navbar],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  nombreUsuario = '';

  estadisticas = {
    ramosInscritos: 0,
    promedioGeneral: 0.0
  };

  proximaClase = {
    ramo: 'Sin clases hoy',
    horario: '--:-- – --:--',
    sala: 'N/A'
  };

  progresoMalla = 0;
  promedioActual = '0.0 / 7.0';
  proximaEntrega = {
    nombre: 'Sin entregas pendientes',
    fecha: '--'
  };

  eventosProximos: any[] = [];
  
  diasConClases = {
    L: false, M: false, X: false, J: false, V: false, S: false, D: false
  };

  constructor(
    private authService: AuthService,
    private ramoService: RamoService,
    private horarioService: HorarioService,
    private evaluacionService: EvaluacionService
  ) {}

  ngOnInit() {
    const usuario = this.authService.getUsuario();
    if (usuario && usuario.nombre) {
      this.nombreUsuario = usuario.nombre;
    } else {
      this.nombreUsuario = 'Estudiante';
    }

    this.cargarDatos();
  }

  cargarDatos() {
    // 1. Cargar Ramos (Malla)
    this.ramoService.getRamos().subscribe((ramos: Ramo[]) => {
      // Progreso Malla y Ramos Inscritos
      const aprobados = ramos.filter(r => r.aprobado);
      const cursando = ramos.filter(r => r.cursando);
      
      this.estadisticas.ramosInscritos = cursando.length;
      if (ramos.length > 0) {
        this.progresoMalla = Math.round((aprobados.length / ramos.length) * 100);
      }

      // Promedio General (de ramos aprobados que tengan nota)
      const ramosConNota = aprobados.filter(r => r.nota && r.nota > 0);
      if (ramosConNota.length > 0) {
        const suma = ramosConNota.reduce((acc, r) => acc + (r.nota || 0), 0);
        this.estadisticas.promedioGeneral = Number((suma / ramosConNota.length).toFixed(1));
      }

      // 2. Cargar Evaluaciones
      this.evaluacionService.getEvaluaciones().subscribe(evaluaciones => {
        // Filtrar evaluaciones futuras
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        const futuras = evaluaciones.filter(e => {
          if (!e.fecha) return false;
          const fechaEv = new Date(e.fecha);
          // Ajustar por zona horaria simple
          fechaEv.setMinutes(fechaEv.getMinutes() + fechaEv.getTimezoneOffset());
          return fechaEv >= hoy;
        }).sort((a, b) => {
          return new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime();
        });

        const colors = ['pink', 'blue', 'green', 'yellow', 'purple'];
        this.eventosProximos = futuras.slice(0, 4).map((e, index) => {
          const ramoRelacionado = ramos.find(r => r.id === e.ramoId);
          return {
            id: e.id,
            titulo: e.nombre + (ramoRelacionado ? ` - ${ramoRelacionado.nombre}` : ''),
            fecha: this.formatearFecha(e.fecha!),
            hora: 'Por definir', // Evaluaciones no tienen hora exacta en el modelo actual
            color: colors[index % colors.length]
          };
        });

        if (this.eventosProximos.length > 0) {
          this.proximaEntrega = {
            nombre: futuras[0].nombre,
            fecha: this.formatearFecha(futuras[0].fecha!)
          };
        }

        // Calcular promedio actual (de evaluaciones con nota)
        const conNota = evaluaciones.filter(e => e.nota && e.nota > 0);
        if (conNota.length > 0) {
          const sumaNotas = conNota.reduce((acc, e) => acc + (e.nota! * (e.ponderacion / 100)), 0);
          const sumaPond = conNota.reduce((acc, e) => acc + (e.ponderacion / 100), 0);
          const prom = sumaPond > 0 ? sumaNotas / sumaPond : 0;
          this.promedioActual = `${prom.toFixed(1)} / 7.0`;
        }
      });
    });

    // 3. Cargar Horario
    this.horarioService.obtenerHorario(1).subscribe(bloques => {
      // Marcar días con clases
      const diasMap: { [key: string]: 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D' } = {
        'Lunes': 'L', 'Martes': 'M', 'Miercoles': 'X', 'Jueves': 'J', 'Viernes': 'V', 'Sabado': 'S', 'Domingo': 'D'
      };

      const diasConClasesSet = new Set<string>();

      bloques.forEach(b => {
        if (b.ramoId) {
          diasConClasesSet.add(b.dia);
        }
      });

      diasConClasesSet.forEach(diaStr => {
        const diaLetra = diasMap[diaStr];
        if (diaLetra) {
          this.diasConClases[diaLetra] = true;
        }
      });

      // Calcular próxima clase (simplificado: primer bloque de hoy o mañana)
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const hoyIdx = new Date().getDay();
      const diaHoyStr = diasSemana[hoyIdx];

      const bloquesHoy = bloques.filter(b => b.dia === diaHoyStr && b.ramoId);
      
      if (bloquesHoy.length > 0) {
        // Asumimos que están ordenados o tomamos el primero
        const b = bloquesHoy[0];
        // Buscar el nombre del ramo (requiere tener la lista de ramos, la cargamos antes)
        this.ramoService.getRamos().subscribe((ramos: Ramo[]) => {
          const ramo = ramos.find((r: Ramo) => r.id === b.ramoId);
          this.proximaClase = {
            ramo: ramo ? ramo.nombre : 'Clase',
            horario: `Hoy, ${b.hora}`,
            sala: b.detalle1 || b.detalle2 || 'Sala por definir'
          };
        });
      } else {
        // Buscar clase mañana
        const diaMananaStr = diasSemana[(hoyIdx + 1) % 7];
        const bloquesManana = bloques.filter(b => b.dia === diaMananaStr && b.ramoId);
        if (bloquesManana.length > 0) {
          const b = bloquesManana[0];
          this.ramoService.getRamos().subscribe((ramos: Ramo[]) => {
            const ramo = ramos.find((r: Ramo) => r.id === b.ramoId);
            this.proximaClase = {
              ramo: ramo ? ramo.nombre : 'Clase',
              horario: `Mañana, ${b.hora}`,
              sala: b.detalle1 || b.detalle2 || 'Sala por definir'
            };
          });
        }
      }
    });
  }

  private formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr);
    fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset()); // Fix timezone issue
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  logout() {
    this.authService.logout();
  }
}
