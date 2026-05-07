import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Coordinates } from '../models/gasolinera.model';
import { environment } from '../../environments/environment';

export interface OsrmRoute {
  geometry: { type: string; coordinates: [number, number][] };
  distanceMeters: number;
  durationSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class OsrmService {
  private http = inject(HttpClient);

  // Returns distances in meters from origin to each destination.
  // Returns null if OSRM does not respond so the caller can use Haversine as fallback.
  getDistances(origin: Coordinates, destinations: Coordinates[]): Observable<number[] | null> {
    const coords = [origin, ...destinations]
      .map(c => `${c.lng},${c.lat}`)
      .join(';');

    return this.http.get<{ distances: number[][] }>(
      `${environment.osrmBaseUrl}/table/v1/driving/${coords}?sources=0&annotations=distance`
    ).pipe(
      map(res => res.distances[0].slice(1)),
      catchError(() => of(null))
    );
  }

  getRoute(origin: Coordinates, destination: Coordinates): Observable<OsrmRoute | null> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    return this.http.get<{ routes: { geometry: any; distance: number; duration: number }[] }>(
      `${environment.osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`
    ).pipe(
      map(res => ({
        geometry: res.routes[0].geometry,
        distanceMeters: res.routes[0].distance,
        durationSeconds: res.routes[0].duration,
      })),
      catchError(() => of(null))
    );
  }
}
