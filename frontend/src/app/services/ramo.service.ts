import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ramo } from '../models/ramo.model';
import { environment } from '../../environtment/environtment.prod';
import { MallaPredeterminadaDTO } from '../models/malla-predeterminada.model';

@Injectable({
  providedIn: 'root'
})
export class RamoService {

  private apiUrl = `${environment.apiUrl}/api/ramos`;
  private apiUrlMallas = `${environment.apiUrl}/api/mallas-predeterminadas`;

  constructor(private http: HttpClient) {}

  getRamos(): Observable<Ramo[]> {
    return this.http.get<Ramo[]>(this.apiUrl);
  }

  crearRamo(ramo: Ramo): Observable<Ramo> {
    return this.http.post<Ramo>(this.apiUrl, ramo);
  }

  actualizarRamo(id: number, ramo: Ramo): Observable<Ramo> {
    return this.http.put<Ramo>(`${this.apiUrl}/${id}`, ramo);
  }

  eliminarRamo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  eliminarTodos(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/todos`);
  }

  cargarMallaPredeterminada(ramos: Ramo[]): Observable<Ramo[]> {
    return this.http.post<Ramo[]>(`${this.apiUrl}/bulk`, ramos);
  }

  getAvance(): Observable<{ porcentaje: number }> {
    return this.http.get<{ porcentaje: number }>(`${this.apiUrl}/avance`);
  }

  cambiarEstado(id: number, aprobado: boolean, cursando: boolean): Observable<Ramo> {
    return this.http.patch<Ramo>(`${this.apiUrl}/${id}/estado`, { aprobado, cursando });
  }

  cambiarEstadoBulk(estados: { id: number, aprobado: boolean, cursando: boolean }[]): Observable<Ramo[]> {
    return this.http.put<Ramo[]>(`${this.apiUrl}/bulk/estado`, estados);
  }

  obtenerMallasPredeterminadas(): Observable<MallaPredeterminadaDTO[]> {
    return this.http.get<MallaPredeterminadaDTO[]>(this.apiUrlMallas);
  }

  publicarMallaPredeterminada(malla: MallaPredeterminadaDTO): Observable<MallaPredeterminadaDTO> {
    return this.http.post<MallaPredeterminadaDTO>(this.apiUrlMallas, malla);
  }

  eliminarMallaPredeterminada(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrlMallas}/${id}`);
  }

  importarConIA(imagen: File): Observable<Ramo[]> {
    const formData = new FormData();
    formData.append('imagen', imagen);
    return this.http.post<Ramo[]>(`${this.apiUrl}/importar-ia`, formData);
  }
}