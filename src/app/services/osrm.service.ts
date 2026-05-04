import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Coordenadas } from '../models/gasolinera.model';

@Injectable({ providedIn: 'root' })
export class OsrmService {
  private http = inject(HttpClient);
  private readonly base = 'https://router.project-osrm.org/table/v1/driving';

  // Devuelve distancias en metros desde origen a cada destino.
  // Si OSRM no responde, devuelve null para que el llamador use Haversine.
  calcularDistancias(origen: Coordenadas, destinos: Coordenadas[]): Observable<number[] | null> {
    const coords = [origen, ...destinos]
      .map(c => `${c.lng},${c.lat}`)
      .join(';');
    const url = `${this.base}/${coords}?sources=0&annotations=distance`;

    return this.http.get<{ distances: number[][] }>(url).pipe(
      map(res => res.distances[0].slice(1)),
      catchError(() => of(null))
    );
  }
}
