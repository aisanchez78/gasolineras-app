import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, of, catchError, throwError } from 'rxjs';
import { GeoService } from './geo.service';
import { OsrmService } from './osrm.service';
import { ErrorService } from './error.service';
import { Gasolinera, GasolineraAPI, RespuestaAPI, ActiveFilters, Coordinates, SortOrder, FuelType } from '../models/gasolinera.model';
import { environment } from '../../environments/environment';

const MAX_CANDIDATOS_OSRM = 80;

@Injectable({ providedIn: 'root' })
export class GasolineraService {
  private http     = inject(HttpClient);
  private geo      = inject(GeoService);
  private osrm     = inject(OsrmService);
  private errorSvc = inject(ErrorService);
  private readonly apiUrl = environment.apiUrl;

  fetchAllStations(): Observable<GasolineraAPI[]> {
    return this.http.get<RespuestaAPI>(this.apiUrl).pipe(
      map(res => res.ListaEESSPrecio ?? []),
      catchError(err => {
        this.errorSvc.error(
          'No se pudieron cargar las gasolineras. El servicio de datos del Ministerio de Energía (MINETUR) no está disponible.'
        );
        return throwError(() => err);
      })
    );
  }

  // Phase 1 — synchronous: maps raw API data, calculates Haversine, filters by radius/fuel/brand. No limit of 20.
  filterCandidates(rawStations: GasolineraAPI[], location: Coordinates, filters: ActiveFilters): Gasolinera[] {
    return rawStations
      .map(raw => {
        const lat = parseFloat(raw.Latitud?.replace(',', '.') ?? '0');
        const lng = parseFloat((raw['Longitud (WGS84)'] ?? raw.Longitud ?? '0').replace(',', '.'));
        const station: Gasolinera = {
          id:         raw.IDEESS,
          name:       raw['Rótulo'] || 'Sin nombre',
          address:    raw.Dirección,
          city:       raw.Municipio,
          province:   raw.Provincia,
          postalCode: raw['C.P.'],
          schedule:   raw.Horario,
          lat,
          lng,
          prices: {
            gasolina95:    this.normalizePrice(raw['Precio Gasolina 95 E5']),
            gasoil:        this.normalizePrice(raw['Precio Gasoleo A']),
            gasolina98:    this.normalizePrice(raw['Precio Gasolina 98 E5']),
            gasoilPremium: this.normalizePrice(raw['Precio Gasoil Premium']),
          },
          distance: this.geo.calcDistanceKm(location.lat, location.lng, lat, lng),
          isOpen:   this.isStationOpen(raw.Horario),
        };
        return station;
      })
      .filter(s =>
        s.distance <= filters.radiusKm
        && (filters.brands.length === 0 ||
            (filters.brandMode === 'deny'
              ? !filters.brands.some(b => b.toUpperCase() === s.name.toUpperCase())
              : filters.brands.some(b => b.toUpperCase() === s.name.toUpperCase())))
        && s.prices[filters.fuelType] !== ''
        && s.lat !== 0 && s.lng !== 0
      );
  }

  // Phase 2 — async: replaces Haversine distances with real distances via OSRM.
  // If OSRM fails, returns candidates with Haversine distances intact.
  enrichWithRealDistances(candidates: Gasolinera[], location: Coordinates): Observable<Gasolinera[]> {
    const preselection = [...candidates]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_CANDIDATOS_OSRM);

    const destinations = preselection.map(s => ({ lat: s.lat, lng: s.lng }));

    return this.osrm.getDistances(location, destinations).pipe(
      switchMap(meters =>
        meters
          ? of(preselection.map((s, i) => ({ ...s, distance: meters[i] / 1000 })))
          : of(preselection)
      )
    );
  }

  // Sorts and limits to 20. Call after enrichWithRealDistances or when only order changes.
  sortAndLimit(stations: Gasolinera[], order: SortOrder, fuelType: FuelType): Gasolinera[] {
    return [...stations].sort((a, b) => {
      if (order === 'distance') return a.distance - b.distance;
      if (order === 'name')     return a.name.localeCompare(b.name);
      const pa = parseFloat(a.prices[fuelType]) || 9999;
      const pb = parseFloat(b.prices[fuelType]) || 9999;
      return pa - pb;
    }).slice(0, 20);
  }

  private normalizePrice(raw: string): string {
    if (!raw || raw.trim() === '') return '';
    return raw.trim().replace(',', '.');
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
