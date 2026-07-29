import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { forkJoin, timeout, catchError, of } from 'rxjs';
import { RamoService } from '../../services/ramo.service';
import { HorarioService, BloqueHorarioDTO } from '../../services/horario.service';
import { Ramo } from '../../models/ramo.model';
import { Navbar } from '../shared/navbar/navbar';

@Component({
  selector: 'app-horario',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, Navbar],
  templateUrl: './horario.html',
  styleUrl: './horario.css'
})
export class Horario implements OnInit {
  ramosCursando: Ramo[] = [];
  guardando = false;
  private saveTimer: any = null;
  private savePending = false;
  private saveInFlight = false;

  // Paleta de colores para los ramos
  private RAMO_COLORS = [
    { bg: '#ede9fe', border: '#7c3aed', text: '#5b21b6' }, // violeta
    { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8' }, // azul
    { bg: '#d1fae5', border: '#059669', text: '#065f46' }, // verde
    { bg: '#fef3c7', border: '#d97706', text: '#92400e' }, // ámbar
    { bg: '#fce7f3', border: '#db2777', text: '#9d174d' }, // rosa
    { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' }, // rojo
    { bg: '#e0f2fe', border: '#0284c7', text: '#075985' }, // celeste
    { bg: '#f0fdf4', border: 'rgba(22, 163, 74, 1)', text: '#14532d' }, // esmeralda
    { bg: '#fdf4ff', border: '#a21caf', text: '#701a75' }, // fucsia
    { bg: '#fff7ed', border: '#ea580c', text: '#7c2d12' }, // naranja
    { bg: '#f0f9ff', border: '#0369a1', text: '#0c4a6e' }, // azul oscuro
    { bg: '#fefce8', border: '#ca8a04', text: '#713f12' }, // amarillo
  ];

  private ramoColorMap: Map<number, number> = new Map();
  private colorIndex = 0;

  // Opciones para el select de sección
  seccionOpciones = [
    { value: 'TEO', label: '📘 TEO' },
    { value: 'LAB', label: '🔬 LAB' },
    { value: 'TEO OP.1', label: '📘 TEO OP.1' },
    { value: 'TEO OP.2', label: '📘 TEO OP.2' },
    { value: 'LAB OP.1', label: '🔬 LAB OP.1' },
    { value: 'LAB OP.2', label: '🔬 LAB OP.2' },
    { value: 'OTRO', label: '✏️ Otro...' },
  ];

  // Rastrear qué slots están en modo texto libre
  private customModeSlots = new Set<string>();

  cargandoHorario = true;

  dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Nombres internos (llaves de base de datos)
  bloquesKeys = [
    'Bloque 1', 'Bloque 2', 'Bloque 3', 'Bloque 4',
    'Bloque 5', 'Bloque 6', 'Bloque 7', 'Bloque 8'
  ];

  // Etiquetas visuales por defecto (editables)
  etiquetasHoraPorDefecto: { [key: string]: string } = {
    'Bloque 1': '08:00 - 09:20',
    'Bloque 2': '09:30 - 10:50',
    'Bloque 3': '11:00 - 12:20',
    'Bloque 4': '12:30 - 13:50',
    'Bloque 5': '14:00 - 15:20',
    'Bloque 6': '16:00 - 17:20',
    'Bloque 7': '17:30 - 18:50',
    'Bloque 8': '19:00 - 20:10' // Aproximación para que llegue hasta las 20:00+
  };

  etiquetasHora: { [key: string]: string } = {};
  editandoBloque: string | null = null; // Guarda la llave del bloque que se está editando

  grilla: BloqueHorarioDTO[] = [];

  constructor(
    private ramoService: RamoService,
    private horarioService: HorarioService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.cargarEtiquetasGuardadas();
    this.inicializarGrilla();
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargandoHorario = true;
    const TIMEOUT_MS = 15000; // 15 segundos de timeout

    const ramos$ = this.ramoService.getRamos().pipe(
      timeout(TIMEOUT_MS),
      catchError(err => {
        console.error('Error/timeout al cargar ramos:', err);
        return of([] as Ramo[]);
      })
    );

    const bloques$ = this.horarioService.obtenerHorario().pipe(
      timeout(TIMEOUT_MS),
      catchError(err => {
        console.error('Error/timeout al cargar bloques del horario:', err);
        return of([] as BloqueHorarioDTO[]);
      })
    );

    forkJoin({ ramos: ramos$, bloques: bloques$ }).subscribe({
      next: ({ ramos, bloques }) => {
        this.ramosCursando = (ramos ?? []).filter(r => r.cursando);

        this.grilla = this.grilla.map(b => {
          const dbBloque = (bloques ?? []).find(db => db.dia === b.dia && db.hora === b.hora);
          if (dbBloque) {
            b.ramoId = dbBloque.ramoId;
            b.ramo2Id = dbBloque.ramo2Id;
            b.detalle1 = dbBloque.detalle1 || '';
            b.detalle2 = dbBloque.detalle2 || '';
          }
          return b;
        });

        // Si ambas llamadas fallaron, mostrar alerta
        if ((ramos ?? []).length === 0 && (bloques ?? []).length === 0) {
          console.warn('No se pudieron obtener datos. El servidor puede estar iniciándose.');
        }
        this.cargandoHorario = false;
        this.cdr.detectChanges(); // Forzar actualización visual
      },
      error: (err) => {
        console.error('Error al cargar datos del horario:', err);
        Swal.fire('Atención', 'Hubo un problema al cargar tu horario. El servidor puede estar iniciándose, intenta recargar en unos segundos.', 'error');
        this.cargandoHorario = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarEtiquetasGuardadas() {
    const guardadas = localStorage.getItem('etiquetas_hora');
    if (guardadas) {
      this.etiquetasHora = JSON.parse(guardadas);
    } else {
      this.etiquetasHora = { ...this.etiquetasHoraPorDefecto };
    }
  }

  guardarEtiquetas() {
    localStorage.setItem('etiquetas_hora', JSON.stringify(this.etiquetasHora));
    this.editandoBloque = null;
  }

  iniciarEdicion(bloqueKey: string) {
    this.editandoBloque = bloqueKey;
  }

  inicializarGrilla() {
    this.grilla = [];
    for (let hora of this.bloquesKeys) {
      for (let dia of this.dias) {
        this.grilla.push({
          id: `${dia}-${hora}`,
          dia,
          hora,
          ramoId: null,
          ramo2Id: null,
          detalle1: '',
          detalle2: ''
        });
      }
    }
  }

  // Se eliminó cargarRamosCursando porque ahora está en cargarDatos

  getBloque(dia: string, hora: string): BloqueHorarioDTO {
    return this.grilla.find(b => b.dia === dia && b.hora === hora) ||
      { id: '', dia, hora, ramoId: null, ramo2Id: null, detalle1: '', detalle2: '' };
  }

  asignarRamo(bloque: BloqueHorarioDTO, value: number | null, isSegundoRamo: boolean = false) {
    // Buscar el bloque real en la grilla para garantizar mutación correcta
    const bloqueReal = this.grilla.find(b => b.dia === bloque.dia && b.hora === bloque.hora);
    const target = bloqueReal ?? bloque;
    if (isSegundoRamo) {
      target.ramo2Id = value;
      // Si se quita el tope, también se limpia su detalle
      if (!value) {
        target.detalle2 = '';
      }
    } else {
      target.ramoId = value;
      // Si se quita el ramo principal, también se quita el tope
      if (!value) {
        target.ramo2Id = null;
        target.detalle1 = '';
        target.detalle2 = '';
      }
    }
    this.cdr.detectChanges();
    this.guardarHorarioEnAPI();
  }

  actualizarDetalle(bloque: BloqueHorarioDTO) {
    this.guardarHorarioEnAPI();
  }

  getRamoNombre(id: number | null): string {
    if (!id) return '';
    const ramo = this.ramosCursando.find(r => r.id === id);
    return ramo ? ramo.nombre : '';
  }

  /** Retorna el valor que debe mostrar el select de sección */
  getSeccionValue(detalle: string | undefined, dia: string, hora: string, slot: number): string {
    if (!detalle) {
      return this.customModeSlots.has(`${dia}|${hora}|${slot}`) ? 'OTRO' : '';
    }
    // Si el valor guardado no es una opción predefinida, es un texto personalizado
    const esPredefinida = this.seccionOpciones.some(op => op.value === detalle && op.value !== 'OTRO');
    return esPredefinida ? detalle : 'OTRO';
  }

  /** True cuando el slot debe mostrar el input de texto libre */
  isCustomMode(dia: string, hora: string, slot: number): boolean {
    const key = `${dia}|${hora}|${slot}`;
    if (this.customModeSlots.has(key)) return true;
    const bloque = this.getBloque(dia, hora);
    const detalle = slot === 1 ? bloque.detalle1 : bloque.detalle2;
    if (!detalle) return false;
    return !this.seccionOpciones.some(op => op.value === detalle && op.value !== 'OTRO');
  }

  /** Maneja el cambio del select de sección */
  onSeccionChange(bloque: BloqueHorarioDTO, value: string, slot: number) {
    const target = this.grilla.find(b => b.dia === bloque.dia && b.hora === bloque.hora) ?? bloque;
    const key = `${bloque.dia}|${bloque.hora}|${slot}`;
    if (value === 'OTRO') {
      this.customModeSlots.add(key);
      // Limpiar para que el usuario escriba desde cero
      if (slot === 1) target.detalle1 = '';
      else target.detalle2 = '';
    } else {
      this.customModeSlots.delete(key);
      if (slot === 1) target.detalle1 = value;
      else target.detalle2 = value;
      this.guardarHorarioEnAPI();
    }
    this.cdr.detectChanges();
  }

  get ramosEnHorario(): number {
    const ids = new Set<number>();
    this.grilla.forEach(b => {
      if (b.ramoId) ids.add(b.ramoId);
      if (b.ramo2Id) ids.add(b.ramo2Id);
    });
    return ids.size;
  }

  getColorRamo(id: number | null | undefined): { bg: string; border: string; text: string } | null {
    if (!id) return null;
    if (!this.ramoColorMap.has(id)) {
      this.ramoColorMap.set(id, this.colorIndex % this.RAMO_COLORS.length);
      this.colorIndex++;
    }
    return this.RAMO_COLORS[this.ramoColorMap.get(id)!];
  }

  getSlotStyle(id: number | null | undefined): { [key: string]: string } {
    const color = this.getColorRamo(id);
    if (!color) return {};
    return {
      'background': color.bg,
      'border-color': color.border,
      'border-width': '1.5px',
      'border-style': 'solid'
    };
  }

  getSelectStyle(id: number | null | undefined): { [key: string]: string } {
    const color = this.getColorRamo(id);
    if (!color) return {};
    return { 'color': color.text };
  }

  // Se eliminó cargarHorarioDesdeAPI porque ahora está en cargarDatos

  guardarHorarioEnAPI() {
    // Debounce: esperar 500ms antes de guardar para agrupar cambios rápidos
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.guardando = true;
    this.saveTimer = setTimeout(() => {
      this.ejecutarGuardado();
    }, 500);
  }

  private ejecutarGuardado() {
    // Si ya hay un guardado en curso, marcar como pendiente y esperar
    if (this.saveInFlight) {
      this.savePending = true;
      return;
    }

    this.saveInFlight = true;
    this.guardando = true;

    // Copiar el estado actual de la grilla para enviar
    const grillaSnapshot = this.grilla.map(b => ({ ...b }));

    this.horarioService.guardarHorario(grillaSnapshot).subscribe({
      next: () => {
        this.saveInFlight = false;
        // Si hay un guardado pendiente, ejecutarlo ahora con el estado más reciente
        if (this.savePending) {
          this.savePending = false;
          this.ejecutarGuardado();
        } else {
          this.guardando = false;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar horario:', err);
        this.saveInFlight = false;
        this.savePending = false;
        this.guardando = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'Ocurrió un error al guardar tu horario.', 'error');
      }
    });
  }


  limpiarHorario() {
    Swal.fire({
      title: 'Limpiar horario',
      text: '¿Estás seguro de limpiar todo tu horario?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.guardando = true;
        this.cdr.detectChanges();
        this.horarioService.limpiarHorario().subscribe({
          next: () => {
            this.grilla.forEach(b => {
              b.ramoId = null;
              b.ramo2Id = null;
              b.detalle1 = '';
              b.detalle2 = '';
            });
            this.customModeSlots.clear();
            this.guardando = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al limpiar horario:', err);
            this.guardando = false;
            this.cdr.detectChanges();
            Swal.fire('Error', 'Ocurrió un error al limpiar tu horario.', 'error');
          }
        });
      }
    });
  }
}
