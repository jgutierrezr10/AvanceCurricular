import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, timeout, catchError } from 'rxjs';
import Swal from 'sweetalert2';
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

  mejoresRamos: { ramo: string, promedio: number }[] = [];

  constructor(
    private authService: AuthService,
    private ramoService: RamoService,
    private horarioService: HorarioService,
    private evaluacionService: EvaluacionService,
    private cdr: ChangeDetectorRef
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
    const TIMEOUT_MS = 15000;

    const ramos$ = this.ramoService.getRamos().pipe(
      timeout(TIMEOUT_MS),
      catchError(err => {
        console.error('Error/timeout al cargar ramos en dashboard:', err);
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error al cargar malla', showConfirmButton: false, timer: 3000 });
        return of([] as Ramo[]);
      })
    );

    const evaluaciones$ = this.evaluacionService.getEvaluaciones().pipe(
      timeout(TIMEOUT_MS),
      catchError(err => {
        console.error('Error/timeout al cargar evaluaciones en dashboard:', err);
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error al cargar notas', showConfirmButton: false, timer: 3000 });
        return of([] as Evaluacion[]);
      })
    );

    const bloques$ = this.horarioService.obtenerHorario(1).pipe(
      timeout(TIMEOUT_MS),
      catchError(err => {
        console.error('Error/timeout al cargar horario en dashboard:', err);
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error al cargar horario', showConfirmButton: false, timer: 3000 });
        return of([] as BloqueHorarioDTO[]);
      })
    );

    forkJoin({ ramos: ramos$, evaluaciones: evaluaciones$, bloques: bloques$ }).subscribe({
      next: ({ ramos, evaluaciones, bloques }) => {
        const safeRamos = ramos || [];
        const safeEvaluaciones = evaluaciones || [];
        const safeBloques = bloques || [];

        // 1. Ramos (Malla & Cursando)
        const aprobados = safeRamos.filter(r => r.aprobado);
        const cursando = safeRamos.filter(r => r.cursando);

        this.estadisticas.ramosInscritos = cursando.length;
        if (safeRamos.length > 0) {
          this.progresoMalla = Math.round((aprobados.length / safeRamos.length) * 100);
        } else {
          this.progresoMalla = 0;
        }

        // 2. Evaluaciones
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const futuras = safeEvaluaciones.filter(e => {
          if (!e.fecha) return false;
          const fechaEv = new Date(e.fecha);
          fechaEv.setMinutes(fechaEv.getMinutes() + fechaEv.getTimezoneOffset());
          return fechaEv >= hoy;
        }).sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime());

        const colors = ['pink', 'blue', 'green', 'yellow', 'purple'];
        this.eventosProximos = futuras.slice(0, 4).map((e, index) => {
          const ramoRelacionado = safeRamos.find(r => r.id === e.ramoId);
          return {
            id: e.id,
            titulo: e.nombre + (ramoRelacionado ? ` - ${ramoRelacionado.nombre}` : ''),
            fecha: this.formatearFecha(e.fecha!),
            hora: 'Por definir',
            color: colors[index % colors.length]
          };
        });

        if (futuras.length > 0) {
          this.proximaEntrega = {
            nombre: futuras[0].nombre,
            fecha: this.formatearFecha(futuras[0].fecha!)
          };
        } else {
          this.proximaEntrega = {
            nombre: 'Sin entregas pendientes',
            fecha: '--'
          };
        }

        // Calcular promedio actual
        const conNota = safeEvaluaciones.filter(e => e.nota && e.nota > 0);
        if (conNota.length > 0) {
          const sumaNotas = conNota.reduce((acc, e) => acc + (e.nota! * (e.ponderacion / 100)), 0);
          const sumaPond = conNota.reduce((acc, e) => acc + (e.ponderacion / 100), 0);
          const prom = sumaPond > 0 ? sumaNotas / sumaPond : 0;
          this.promedioActual = `${prom.toFixed(1)} / 7.0`;
        } else {
          this.promedioActual = '0.0 / 7.0';
        }

        // Calcular promedios por ramo cursando
        const promediosSemestre: number[] = [];
        const topRamosTemp: { ramo: string; promedio: number }[] = [];

        cursando.forEach(ramo => {
          const evsRamo = safeEvaluaciones.filter(e => e.ramoId === ramo.id && e.nota && e.nota > 0 && e.ponderacion > 0);
          if (evsRamo.length > 0) {
            const sumaNotas = evsRamo.reduce((acc, e) => acc + (e.nota! * (e.ponderacion / 100)), 0);
            const sumaPond = evsRamo.reduce((acc, e) => acc + (e.ponderacion / 100), 0);
            const promRamo = sumaPond > 0 ? sumaNotas / sumaPond : 0;

            promediosSemestre.push(promRamo);
            topRamosTemp.push({ ramo: ramo.nombre, promedio: promRamo });
          }
        });

        if (promediosSemestre.length > 0) {
          const sumaSemestre = promediosSemestre.reduce((acc, p) => acc + p, 0);
          this.estadisticas.promedioGeneral = Number((sumaSemestre / promediosSemestre.length).toFixed(1));
        } else {
          this.estadisticas.promedioGeneral = 0;
        }

        topRamosTemp.sort((a, b) => b.promedio - a.promedio);
        this.mejoresRamos = topRamosTemp.slice(0, 3);

        // 3. Horario (Días con clases y próxima clase)
        const diasMap: { [key: string]: 'L' | 'M' | 'X' | 'J' | 'V' | 'S' | 'D' } = {
          'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'X', 'Jueves': 'J', 'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D'
        };

        this.diasConClases = { L: false, M: false, X: false, J: false, V: false, S: false, D: false };
        const diasConClasesSet = new Set<string>();

        safeBloques.forEach(b => {
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

        // Próxima clase
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const now = new Date();
        const hoyIdx = now.getDay();
        const diaHoyStr = diasSemana[hoyIdx];
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        let etiquetasHora = {};
        try { etiquetasHora = JSON.parse(localStorage.getItem('etiquetas_hora') || '{}'); } catch (e) { }
        const etiquetasPorDefecto: any = {
          'Bloque 1': '08:00 - 09:20', 'Bloque 2': '09:30 - 10:50', 'Bloque 3': '11:00 - 12:20', 'Bloque 4': '12:30 - 13:50',
          'Bloque 5': '14:00 - 15:20', 'Bloque 6': '16:00 - 17:20', 'Bloque 7': '17:30 - 18:50', 'Bloque 8': '19:00 - 20:10'
        };

        const getLabel = (bloqueHoraStr: string) => (etiquetasHora as any)[bloqueHoraStr] || etiquetasPorDefecto[bloqueHoraStr] || bloqueHoraStr;
        const getEndTime = (bloqueHoraStr: string) => {
          const parts = getLabel(bloqueHoraStr).split('-');
          return parts.length > 1 ? parts[1].trim() : '23:59';
        };

        const timeToMinutes = (timeStr: string) => {
          let str = timeStr.toLowerCase().trim();
          let isPM = str.includes('p');
          let isAM = str.includes('a');
          str = str.replace(/[^\d:]/g, '');
          let parts = str.split(':');
          let h = parseInt(parts[0] || '0', 10);
          let m = parseInt(parts[1] || '0', 10);
          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;
          return h * 60 + m;
        };

        const currentTimeMins = timeToMinutes(currentTime);

        const bloquesHoy = safeBloques.filter(b => b.dia === diaHoyStr && b.ramoId)
          .filter(b => timeToMinutes(getEndTime(b.hora)) >= currentTimeMins);

        if (bloquesHoy.length > 0) {
          const b = bloquesHoy[0];
          const ramo = safeRamos.find(r => r.id === b.ramoId);
          this.proximaClase = {
            ramo: ramo ? ramo.nombre : 'Clase',
            horario: `Hoy, ${getLabel(b.hora)}`,
            sala: b.detalle1 || b.detalle2 || 'Sala por definir'
          };
        } else {
          let proximaClaseEncontrada = false;
          for (let offset = 1; offset <= 6; offset++) {
            const proxDiaIdx = (hoyIdx + offset) % 7;
            const proxDiaStr = diasSemana[proxDiaIdx];
            const bloquesProxDia = safeBloques.filter(b => b.dia === proxDiaStr && b.ramoId);

            if (bloquesProxDia.length > 0) {
              const b = bloquesProxDia[0];
              const ramo = safeRamos.find(r => r.id === b.ramoId);
              let prefijoDia = offset === 1 ? 'Mañana' : proxDiaStr;
              this.proximaClase = {
                ramo: ramo ? ramo.nombre : 'Clase',
                horario: `${prefijoDia}, ${getLabel(b.hora)}`,
                sala: b.detalle1 || b.detalle2 || 'Sala por definir'
              };
              proximaClaseEncontrada = true;
              break;
            }
          }

          if (!proximaClaseEncontrada) {
            this.proximaClase = { ramo: 'Sin clases próximas', horario: '--:-- – --:--', sala: 'N/A' };
          }
        }

        // Forzar actualización de vista inmediata para evitar fallos de render en móviles
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.cdr.detectChanges();
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'Error de conexión',
          text: 'Hubo un problema al cargar el dashboard.',
          showConfirmButton: false,
          timer: 3000
        });
      }
    });
  }

  private formatearFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr);
    fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  logout() {
    this.authService.logout();
  }
}

