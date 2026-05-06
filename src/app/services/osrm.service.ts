import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Coordenadas } from '../models/gasolinera.model';

export interface RutaOsrm {
  geometry: { type: string; coordinates: [number, number][] };
  distanciaMetros: number;
  duracionSegundos: number;
}

@Injectable({ providedIn: 'root' })
export class OsrmService {
  private http = inject(HttpClient);
  private readonly base = 'https://router.project-osrm.org/table/v1/driving';

  // Devuelve distancias en metros desde origen a cada destino.
  // Retorna null si OSRM no responde para que el llamador use Haversine como fallback.
  calcularDistancias(origen: Coordenadas, destinos: Coordenadas[]): Observable<number[] | null> {
    const coords = [origen, ...destinos]
      .map(c => `${c.lng},${c.lat}`)
      .join(';');

    return this.http.get<{ distances: number[][] }>(
      `${this.base}/${coords}?sources=0&annotations=distance`
    ).pipe(
      map(res => res.distances[0].slice(1)),
      catchError(() => of(null))
    );
  }

  calcularRuta(origen: Coordenadas, destino: Coordenadas): Observable<RutaOsrm | null> {
    const coords = `${origen.lng},${origen.lat};${destino.lng},${destino.lat}`;
    return this.http.get<{ routes: { geometry: any; distance: number; duration: number }[] }>(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    ).pipe(
      map(res => ({
        geometry: res.routes[0].geometry,
        distanciaMetros: res.routes[0].distance,
        duracionSegundos: res.routes[0].duration,
      })),
      catchError(() => of(null))
    );
  }
}
