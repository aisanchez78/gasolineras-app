import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Coordinates } from '../models/gasolinera.model';
import { ErrorService } from './error.service';
import { environment } from '../../environments/environment';

export interface GeoSuggestion {
  label: string;
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http     = inject(HttpClient);
  private errorSvc = inject(ErrorService);

  private suggestionsErrorNotified = false;

  obtenerPosicion(): Observable<Coordinates> {
    if (!navigator.geolocation) {
      return this.getLocationByIp();
    }

    return new Observable(observer => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          observer.next({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          observer.complete();
        },
        err => {
          if (err.code === 1) {
            // Permiso denegado explícitamente — propagar el error sin fallback silencioso
            observer.error(err);
          } else {
            // Posición no disponible o timeout — intentar por IP
            this.getLocationByIp().subscribe({
              next: coords => { observer.next(coords); observer.complete(); },
              error: e => observer.error(e),
            });
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  reverseGeocode(lat: number, lng: number): Observable<string> {
    const url = `${environment.nominatimReverseUrl}?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    return this.http.get<any>(url).pipe(
      map(r => {
        const a = r?.address ?? {};
        const place = a.city || a.town || a.village || a.municipality || a.county || '';
        const region = a.state || '';
        return place && region ? `${place}, ${region}` : place || region || r.display_name;
      }),
      catchError(() => of(`${lat.toFixed(4)}, ${lng.toFixed(4)}`))
    );
  }

  searchSuggestions(query: string): Observable<GeoSuggestion[]> {
    if (query.trim().length < 3) return of([]);
    const url = `${environment.nominatimUrl}?format=json&q=${encodeURIComponent(query)}&countrycodes=es&limit=5&addressdetails=0`;
    return this.http.get<any[]>(url).pipe(
      map(results => results.map(r => ({
        label: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      }))),
      tap(() => { this.suggestionsErrorNotified = false; }),
      catchError(() => {
        if (!this.suggestionsErrorNotified) {
          this.suggestionsErrorNotified = true;
          this.errorSvc.warn(
            'El buscador de direcciones (Nominatim) no está disponible temporalmente.'
          );
        }
        return of([]);
      })
    );
  }

  private getLocationByIp(): Observable<Coordinates> {
    return new Observable(observer => {
      this.http.get<any>(environment.ipApiUrl).subscribe({
        next: data => {
          if (data?.latitude && data?.longitude) {
            observer.next({ lat: data.latitude, lng: data.longitude });
            observer.complete();
          } else {
            observer.error(new Error('No se pudo obtener ubicación por IP'));
          }
        },
        error: () => {
          this.http.get<any>(environment.ipApiFallbackUrl).subscribe({
            next: data => {
              if (data?.lat && data?.lon) {
                observer.next({ lat: data.lat, lng: data.lon });
                observer.complete();
              } else {
                observer.error(new Error('No se pudo obtener ubicación'));
              }
            },
            error: e => observer.error(e),
          });
        },
      });
    });
  }

  calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  geocodeAddress(address: string): Observable<Coordinates & { locationName: string }> {
    const url = `${environment.nominatimUrl}?format=json&q=${encodeURIComponent(address)}&countrycodes=es&limit=1`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (!results || results.length === 0) throw new Error('Dirección no encontrada');
        const r = results[0];
        return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), locationName: r.display_name };
      })
    );
  }
}
