import { Component, signal, ViewChild, ElementRef, AfterViewInit, HostListener, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnInit {
  protected readonly title = signal('frontend');

  @ViewChild('bgCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  currentTool: 'pencil' | 'eraser' = 'pencil';
  
  isDarkMode = false;

  ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  ngAfterViewInit() {
    this.initCanvas();
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    this.loadCanvasFromStorage();
  }

  private saveCanvasToStorage() {
    if (this.canvasRef) {
      const dataUrl = this.canvasRef.nativeElement.toDataURL();
      localStorage.setItem('canvas_drawing', dataUrl);
    }
  }

  private loadCanvasFromStorage() {
    const dataUrl = localStorage.getItem('canvas_drawing');
    if (dataUrl && this.ctx) {
      const img = new Image();
      img.onload = () => {
        if (this.ctx) {
          this.ctx.drawImage(img, 0, 0);
        }
      };
      img.src = dataUrl;
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeCanvas();
  }

  private resizeCanvas() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    
    // Save current drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width || window.innerWidth;
    tempCanvas.height = canvas.height || window.innerHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
    }
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Restore drawing
    if (this.ctx && tempCtx) {
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  setTool(tool: 'pencil' | 'eraser') {
    this.currentTool = tool;
  }

  clearCanvas() {
    if (this.ctx && this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      localStorage.removeItem('canvas_drawing');
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Don't draw if clicking on interactive elements or cards
    if (
      ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(target.tagName) || 
      target.closest('button, a, input, select, textarea, .glass-panel, .progreso-card, .horario-table, .dashboard-grid, .navbar, .top-bar')
    ) {
      return;
    }

    if (this.ctx) {
      this.isDrawing = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      // Prevent text selection while drawing
      event.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing || !this.ctx) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(event.clientX, event.clientY);
    
    if (this.currentTool === 'pencil') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowBlur = 1.5;
      this.ctx.shadowColor = 'rgba(71, 85, 105, 0.5)';
    } else {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = 20;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowBlur = 0;
    }
    
    this.ctx.stroke();

    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.saveCanvasToStorage();
    }
  }
}

