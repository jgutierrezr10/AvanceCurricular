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
  opcionActiva: number = 1;

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

    const bloques$ = this.horarioService.obtenerHorario(this.opcionActiva).pipe(
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

  cambiarOpcion(opcion: number) {
    if (this.opcionActiva === opcion) return;
    this.opcionActiva = opcion;
    this.inicializarGrilla();
    this.cargarDatos();
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

    this.horarioService.guardarHorario(grillaSnapshot, this.opcionActiva).subscribe({
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
        this.horarioService.limpiarHorario(this.opcionActiva).subscribe({
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

  // ══════════════════════════════════════
  // COMPARTIR HORARIO
  // ══════════════════════════════════════

  compartirHorario() {
    const tieneRamos = this.grilla.some(b => b.ramoId || b.ramo2Id);
    if (!tieneRamos) {
      Swal.fire({
        icon: 'info',
        title: 'Horario vacío',
        text: 'Aún no has agregado ramos a tu horario para compartir.',
        confirmButtonColor: '#6c63ff'
      });
      return;
    }

    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

    Swal.fire({
      customClass: {
        popup: 'share-modal-popup'
      },
      html: `
        <div class="share-modal-header">
          <div class="share-modal-icon-badge">
            <i class="bi bi-share-fill"></i>
          </div>
          <h2 class="share-modal-title">Compartir Mi Horario</h2>
          <div class="share-modal-subtitle">
            <span>Opción ${this.opcionActiva}</span>
            <span class="share-modal-badge">${this.ramosEnHorario} ramos asignados</span>
          </div>
        </div>

        <div class="share-modal-options">
          <div id="btn-share-img" class="share-option-card">
            <div class="share-option-icon icon-purple">
              <i class="bi bi-file-earmark-image-fill"></i>
            </div>
            <div class="share-option-content">
              <div class="share-option-title">Descargar Imagen PNG</div>
              <div class="share-option-desc">Exporta tu grilla en alta resolución con colores y leyenda.</div>
            </div>
            <div class="share-option-arrow">
              <i class="bi bi-download"></i>
            </div>
          </div>

          <div id="btn-share-text" class="share-option-card">
            <div class="share-option-icon icon-teal">
              <i class="bi bi-clipboard-check-fill"></i>
            </div>
            <div class="share-option-content">
              <div class="share-option-title">Copiar Resumen de Texto</div>
              <div class="share-option-desc">Copia la lista detallada de ramos y horas al portapapeles.</div>
            </div>
            <div class="share-option-arrow">
              <i class="bi bi-copy"></i>
            </div>
          </div>

          ${canNativeShare ? `
          <div id="btn-share-native" class="share-option-card">
            <div class="share-option-icon icon-blue">
              <i class="bi bi-send-fill"></i>
            </div>
            <div class="share-option-content">
              <div class="share-option-title">Compartir en Aplicaciones</div>
              <div class="share-option-desc">Envía directamente a WhatsApp, Telegram o tus apps.</div>
            </div>
            <div class="share-option-arrow">
              <i class="bi bi-box-arrow-up-right"></i>
            </div>
          </div>` : ''}
        </div>

        <div class="share-modal-footer">
          <i class="bi bi-shield-check"></i>
          <span>Generado automáticamente con tu distribución de ramos</span>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      focusCancel: false,
      didOpen: () => {
        const btnImg = document.getElementById('btn-share-img');
        const btnText = document.getElementById('btn-share-text');
        const btnNative = document.getElementById('btn-share-native');

        if (btnImg) {
          btnImg.addEventListener('click', () => {
            Swal.close();
            this.descargarImagenHorario();
          });
        }
        if (btnText) {
          btnText.addEventListener('click', () => {
            Swal.close();
            this.copiarTextoHorario();
          });
        }
        if (btnNative) {
          btnNative.addEventListener('click', () => {
            Swal.close();
            this.compartirNativoHorario();
          });
        }
      }
    });
  }

  generarTextoHorario(): string {
    let texto = `📅 *MI HORARIO ACADÉMICO* (Opción ${this.opcionActiva})\n\n`;
    let hayCursos = false;

    for (const dia of this.dias) {
      const bloquesDelDia = this.bloquesKeys.map(key => {
        const b = this.getBloque(dia, key);
        return {
          hora: this.etiquetasHora[key] || key,
          r1: b.ramoId ? this.getRamoNombre(b.ramoId) : null,
          d1: b.detalle1,
          r2: b.ramo2Id ? this.getRamoNombre(b.ramo2Id) : null,
          d2: b.detalle2
        };
      }).filter(b => b.r1 || b.r2);

      if (bloquesDelDia.length > 0) {
        hayCursos = true;
        texto += `🔹 *${dia.toUpperCase()}*\n`;
        for (const b of bloquesDelDia) {
          if (b.r1) {
            const det1 = b.d1 ? ` [${b.d1}]` : '';
            texto += `  • ${b.hora} ➔ ${b.r1}${det1}\n`;
          }
          if (b.r2) {
            const det2 = b.d2 ? ` [${b.d2}]` : '';
            texto += `  • ${b.hora} ➔ ${b.r2}${det2} (Tope horario)\n`;
          }
        }
        texto += `\n`;
      }
    }

    if (!hayCursos) {
      return `📅 Mi Horario (Opción ${this.opcionActiva})\nAún no has asignado ramos a tu horario.`;
    }

    return texto.trim();
  }

  copiarTextoHorario() {
    const texto = this.generarTextoHorario();
    navigator.clipboard.writeText(texto).then(() => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: '¡Horario copiado al portapapeles!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }).catch(err => {
      console.error('Error al copiar:', err);
      Swal.fire('Error', 'No se pudo copiar al portapapeles.', 'error');
    });
  }

  descargarImagenHorario() {
    const canvas = this.generarCanvasHorario();
    const link = document.createElement('a');
    link.download = `Horario_Opcion_${this.opcionActiva}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Imagen descargada con éxito',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }

  async compartirNativoHorario() {
    const canvas = this.generarCanvasHorario();
    const texto = this.generarTextoHorario();

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          this.copiarTextoHorario();
          return;
        }
        const file = new File([blob], `Horario_Opcion_${this.opcionActiva}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Mi Horario - Opción ${this.opcionActiva}`,
            text: texto,
            files: [file]
          });
        } else if (navigator.share) {
          await navigator.share({
            title: `Mi Horario - Opción ${this.opcionActiva}`,
            text: texto
          });
        } else {
          this.copiarTextoHorario();
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error al compartir nativamente:', err);
    }
  }

  /** Genera un canvas de alta definición (Retina 2x) con la grilla del horario */
  generarCanvasHorario(): HTMLCanvasElement {
    const scale = 2; // Alta resolución
    const timeColWidth = 130;
    const dayColWidth = 160;
    const headerHeight = 70;
    const tableHeaderHeight = 45;
    const rowHeight = 65;
    const legendHeight = 90;

    const totalWidth = timeColWidth + this.dias.length * dayColWidth;
    const totalHeight = headerHeight + tableHeaderHeight + (this.bloquesKeys.length * rowHeight) + legendHeight;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.scale(scale, scale);

    // Fondo principal
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // 1. Header Banner
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, 0, totalWidth, headerHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`📅 MI HORARIO ACADÉMICO - Opción ${this.opcionActiva}`, 20, 42);

    ctx.fillStyle = '#c7d2fe';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Generado con AULA', totalWidth - 20, 42);

    // 2. Encabezado de la Tabla
    const startY = headerHeight;

    // Fondo del header de la tabla
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, startY, totalWidth, tableHeaderHeight);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;

    // Columna Hora Header
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HORA', timeColWidth / 2, startY + 27);

    // Días Header
    this.dias.forEach((dia, i) => {
      const x = timeColWidth + (i * dayColWidth);
      ctx.fillText(dia.toUpperCase(), x + (dayColWidth / 2), startY + 27);
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + tableHeaderHeight);
      ctx.stroke();
    });

    // 3. Bloques de Tiempo y Celdas
    this.bloquesKeys.forEach((key, rowIndex) => {
      const y = startY + tableHeaderHeight + (rowIndex * rowHeight);

      // Línea divisoria superior de la fila
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalWidth, y);
      ctx.stroke();

      // Columna de hora
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, y, timeColWidth, rowHeight);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const labelHora = this.etiquetasHora[key] || key;
      ctx.fillText(labelHora, timeColWidth / 2, y + (rowHeight / 2) + 4);

      // Celdas por día
      this.dias.forEach((dia, colIndex) => {
        const x = timeColWidth + (colIndex * dayColWidth);

        // Fondo por defecto blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, dayColWidth, rowHeight);

        // Borde izquierdo de celda
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowHeight);
        ctx.stroke();

        const bloque = this.getBloque(dia, key);
        const padding = 4;
        const cellW = dayColWidth - (padding * 2);

        if (bloque.ramoId && bloque.ramo2Id) {
          // 2 Ramos (Tope Horario) - Mitad y Mitad
          const halfH = (rowHeight - (padding * 3)) / 2;

          // Slot 1
          this.renderRamoSlotCanvas(ctx, x + padding, y + padding, cellW, halfH, bloque.ramoId, bloque.detalle1);
          // Slot 2
          this.renderRamoSlotCanvas(ctx, x + padding, y + padding + halfH + padding, cellW, halfH, bloque.ramo2Id, bloque.detalle2);
        } else if (bloque.ramoId) {
          // 1 Ramo regular
          const cellH = rowHeight - (padding * 2);
          this.renderRamoSlotCanvas(ctx, x + padding, y + padding, cellW, cellH, bloque.ramoId, bloque.detalle1);
        }
      });
    });

    // 4. Leyenda de Ramos al Pie
    const legendY = startY + tableHeaderHeight + (this.bloquesKeys.length * rowHeight) + 15;

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RAMOS EN HORARIO:', 20, legendY);

    let curX = 20;
    let curY = legendY + 12;

    this.ramosCursando.forEach((ramo) => {
      const color = this.getColorRamo(ramo.id);
      if (!color) return;

      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(ramo.nombre).width;
      const pillWidth = textWidth + 24;
      const pillHeight = 24;

      if (curX + pillWidth > totalWidth - 20) {
        curX = 20;
        curY += 30;
      }

      this.drawRoundRect(ctx, curX, curY, pillWidth, pillHeight, 12, color.bg, color.border);

      ctx.fillStyle = color.text;
      ctx.textAlign = 'center';
      ctx.fillText(ramo.nombre, curX + (pillWidth / 2), curY + 16);

      curX += pillWidth + 10;
    });

    return canvas;
  }

  private renderRamoSlotCanvas(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ramoId: number,
    detalle?: string
  ) {
    const color = this.getColorRamo(ramoId);
    if (!color) return;

    this.drawRoundRect(ctx, x, y, w, h, 6, color.bg, color.border);

    const ramoNombre = this.fitText(ctx, this.getRamoNombre(ramoId), w - 8, 'bold 11px system-ui, -apple-system, sans-serif');

    ctx.fillStyle = color.text;
    ctx.textAlign = 'center';

    if (detalle && h > 35) {
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(ramoNombre, x + (w / 2), y + (h / 2) - 3);

      ctx.font = '500 10px system-ui, -apple-system, sans-serif';
      ctx.fillText(`[${detalle}]`, x + (w / 2), y + (h / 2) + 11);
    } else {
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(ramoNombre, x + (w / 2), y + (h / 2) + 4);
    }
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fillColor: string,
    borderColor?: string
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (borderColor) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    font: string
  ): string {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated ? truncated + '…' : text;
  }
}

