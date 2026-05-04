import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, of } from 'rxjs';
import { GeoService } from './geo.service';
import { OsrmService } from './osrm.service';
import { Gasolinera, RespuestaAPI, FiltrosActivos, Coordenadas, OrdenResultados } from '../models/gasolinera.model';

const MAX_CANDIDATOS_OSRM = 80;

@Injectable({ providedIn: 'root' })
export class GasolineraService {
  private http  = inject(HttpClient);
  private geo   = inject(GeoService);
  private osrm  = inject(OsrmService);
  private apiUrl = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

  obtenerTodasEstaciones(): Observable<Gasolinera[]> {
    return this.http.get<RespuestaAPI>(this.apiUrl).pipe(
      map((res: RespuestaAPI) => res.ListaEESSPrecio ?? [])
    );
  }

  // Fase 1 — síncrono: calcula Haversine, filtra por radio/carburante/marca. Sin límite de 20.
  filtrarCandidatos(gasolineras: Gasolinera[], posicion: Coordenadas, filtros: FiltrosActivos): Gasolinera[] {
    const campo = this.campoPrecio(filtros.carburante);
    return gasolineras
      .map(g => {
        const lat = parseFloat(g.Latitud?.replace(',', '.') ?? '0');
        const lng = parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.'));
        return {
          ...g,
          distancia: this.geo.calcularDistanciaKm(posicion.lat, posicion.lng, lat, lng),
          abierta: this.estaAbierta(g.Horario),
        };
      })
      .filter(g => {
        const precioStr = g[campo] as string;
        return (g.distancia ?? 999) <= filtros.radioKm
          && (filtros.marcas.length === 0 || filtros.marcas.includes(g['Rótulo']))
          && precioStr && precioStr.trim() !== '';
      });
  }

  // Fase 2 — async: reemplaza distancias Haversine por distancias reales via OSRM.
  // Si OSRM falla, devuelve los candidatos con distancias Haversine intactas.
  enriquecerConDistanciasReales(candidatos: Gasolinera[], posicion: Coordenadas): Observable<Gasolinera[]> {
    const preseleccion = [...candidatos]
      .sort((a, b) => (a.distancia ?? 999) - (b.distancia ?? 999))
      .slice(0, MAX_CANDIDATOS_OSRM);

    const destinos = preseleccion.map(g => ({
      lat: parseFloat(g.Latitud?.replace(',', '.') ?? '0'),
      lng: parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.')),
    }));

    return this.osrm.calcularDistancias(posicion, destinos).pipe(
      switchMap(metros =>
        metros
          ? of(preseleccion.map((g, i) => ({ ...g, distancia: metros[i] / 1000 })))
          : of(preseleccion)
      )
    );
  }

  // Ordena y limita a 20. Llamar tras enriquecerConDistanciasReales o al cambiar sólo el orden.
  ordenarYLimitar(gasolineras: Gasolinera[], orden: OrdenResultados, carburante: FiltrosActivos['carburante']): Gasolinera[] {
    const campo = this.campoPrecio(carburante);
    return [...gasolineras].sort((a, b) => {
      if (orden === 'distancia') return (a.distancia ?? 999) - (b.distancia ?? 999);
      if (orden === 'nombre')    return (a['Rótulo'] ?? '').localeCompare(b['Rótulo'] ?? '');
      const pa = parseFloat((a[campo] as string)?.replace(',', '.')) || 9999;
      const pb = parseFloat((b[campo] as string)?.replace(',', '.')) || 9999;
      return pa - pb;
    }).slice(0, 20);
  }

  private campoPrecio(carburante: FiltrosActivos['carburante']): keyof Gasolinera {
    const mapa: Record<FiltrosActivos['carburante'], keyof Gasolinera> = {
      gasolina95:    'Precio Gasolina 95 E5',
      gasoil:        'Precio Gasoleo A',
      gasolina98:    'Precio Gasolina 98 E5',
      gasoilPremium: 'Precio Gasoil Premium',
    };
    return mapa[carburante];
  }

  private estaAbierta(horario: string): boolean {
    if (!horario || horario.includes('24H')) return true;
    const ahora      = new Date();
    const dia        = ahora.getDay();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    if (dia >= 1 && dia <= 5) return horaActual >= 420 && horaActual <= 1320;
    if (dia === 6)             return horaActual >= 480 && horaActual <= 1260;
    return false;
  }
}
