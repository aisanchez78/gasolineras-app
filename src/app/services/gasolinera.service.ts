import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, of } from 'rxjs';
import { GeoService } from './geo.service';
import { OsrmService } from './osrm.service';
import { Gasolinera, RespuestaAPI, ActiveFilters, Coordinates, SortOrder, FuelType } from '../models/gasolinera.model';
import { environment } from '../../environments/environment';

const MAX_CANDIDATOS_OSRM = 80;

@Injectable({ providedIn: 'root' })
export class GasolineraService {
  private http  = inject(HttpClient);
  private geo   = inject(GeoService);
  private osrm  = inject(OsrmService);
  private readonly apiUrl = environment.apiUrl;

  fetchAllStations(): Observable<Gasolinera[]> {
    return this.http.get<RespuestaAPI>(this.apiUrl).pipe(
      map((res: RespuestaAPI) => res.ListaEESSPrecio ?? [])
    );
  }

  // Phase 1 — synchronous: calculates Haversine, filters by radius/fuel/brand. No limit of 20.
  filterCandidates(stations: Gasolinera[], location: Coordinates, filters: ActiveFilters): Gasolinera[] {
    const field = this.getPriceField(filters.fuelType);
    return stations
      .map(g => {
        const lat = parseFloat(g.Latitud?.replace(',', '.') ?? '0');
        const lng = parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.'));
        return {
          ...g,
          distance: this.geo.calcDistanceKm(location.lat, location.lng, lat, lng),
          isOpen: this.isStationOpen(g.Horario),
        };
      })
      .filter(g => {
        const priceStr = g[field] as string;
        return (g.distance ?? 999) <= filters.radiusKm
          && (filters.brands.length === 0 || filters.brands.includes(g['Rótulo']))
          && priceStr && priceStr.trim() !== '';
      });
  }

  // Phase 2 — async: replaces Haversine distances with real distances via OSRM.
  // If OSRM fails, returns candidates with Haversine distances intact.
  enrichWithRealDistances(candidates: Gasolinera[], location: Coordinates): Observable<Gasolinera[]> {
    const preselection = [...candidates]
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      .slice(0, MAX_CANDIDATOS_OSRM);

    const destinations = preselection.map(g => ({
      lat: parseFloat(g.Latitud?.replace(',', '.') ?? '0'),
      lng: parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.')),
    }));

    return this.osrm.getDistances(location, destinations).pipe(
      switchMap(meters =>
        meters
          ? of(preselection.map((g, i) => ({ ...g, distance: meters[i] / 1000 })))
          : of(preselection)
      )
    );
  }

  // Sorts and limits to 20. Call after enrichWithRealDistances or when only order changes.
  sortAndLimit(stations: Gasolinera[], order: SortOrder, fuelType: FuelType): Gasolinera[] {
    const field = this.getPriceField(fuelType);
    return [...stations].sort((a, b) => {
      if (order === 'distance') return (a.distance ?? 999) - (b.distance ?? 999);
      if (order === 'name')     return (a['Rótulo'] ?? '').localeCompare(b['Rótulo'] ?? '');
      const pa = parseFloat((a[field] as string)?.replace(',', '.')) || 9999;
      const pb = parseFloat((b[field] as string)?.replace(',', '.')) || 9999;
      return pa - pb;
    }).slice(0, 20);
  }

  private getPriceField(fuelType: FuelType): keyof Gasolinera {
    const map: Record<FuelType, keyof Gasolinera> = {
      gasolina95:    'Precio Gasolina 95 E5',
      gasoil:        'Precio Gasoleo A',
      gasolina98:    'Precio Gasolina 98 E5',
      gasoilPremium: 'Precio Gasoil Premium',
    };
    return map[fuelType];
  }

  private isStationOpen(schedule: string): boolean {
    if (!schedule || schedule.includes('24H')) return true;
    const now        = new Date();
    const day        = now.getDay();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    if (day >= 1 && day <= 5) return currentMin >= 420 && currentMin <= 1320;
    if (day === 6)             return currentMin >= 480 && currentMin <= 1260;
    return false;
  }
}
