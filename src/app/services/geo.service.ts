import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Coordinates } from '../models/gasolinera.model';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);

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
          console.warn('GPS falló (code ' + err.code + '), intentando por IP...');
          // Fallback automático a geolocalización por IP
          this.getLocationByIp().subscribe({
            next: coords => { observer.next(coords); observer.complete(); },
            error: e => observer.error(e)
          });
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  private getLocationByIp(): Observable<Coordinates> {
    return new Observable(observer => {
      this.http.get<any>('https://ipapi.co/json/').subscribe({
        next: data => {
          if (data?.latitude && data?.longitude) {
            console.log('Ubicación por IP:', data.city, data.latitude, data.longitude);
            observer.next({ lat: data.latitude, lng: data.longitude });
            observer.complete();
          } else {
            observer.error(new Error('No se pudo obtener ubicación por IP'));
          }
        },
        error: () => {
          // Segundo fallback: ip-api.com
          this.http.get<any>('http://ip-api.com/json').subscribe({
            next: data => {
              if (data?.lat && data?.lon) {
                console.log('Ubicación por ip-api:', data.city, data.lat, data.lon);
                observer.next({ lat: data.lat, lng: data.lon });
                observer.complete();
              } else {
                observer.error(new Error('No se pudo obtener ubicación'));
              }
            },
            error: e => observer.error(e)
          });
        }
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=es&limit=1`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (!results || results.length === 0) {
          throw new Error('Dirección no encontrada');
        }
        const r = results[0];
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          locationName: r.display_name
        };
      })
    );
  }
}
