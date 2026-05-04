import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { GeoService } from './geo.service';
import { Gasolinera, RespuestaAPI, FiltrosActivos, Coordenadas, OrdenResultados } from '../models/gasolinera.model';

@Injectable({ providedIn: 'root' })
export class GasolineraService {
  private http = inject(HttpClient);
  private geo = inject(GeoService);
  private apiUrl = '/api-gasolineras/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/';

  obtenerTodasEstaciones(): Observable<Gasolinera[]> {
    return this.http.get<RespuestaAPI>(this.apiUrl).pipe(
      tap((res: RespuestaAPI) => {
        console.log('Respuesta API completa:', res);
        console.log('Primera gasolinera:', res?.ListaEESSPrecio?.[0]);
        console.log('Total estaciones:', res?.ListaEESSPrecio?.length);
      }),
      map((res: RespuestaAPI) => res.ListaEESSPrecio ?? [])
    );
  }

filtrarYOrdenar(
  gasolineras: Gasolinera[],
  posicion: Coordenadas,
  filtros: FiltrosActivos,
  orden: OrdenResultados = 'precio'
): Gasolinera[] {
  const camposPrecio: Record<FiltrosActivos['carburante'], keyof Gasolinera> = {
    gasolina95:    'Precio Gasolina 95 E5',
    gasoil:        'Precio Gasoleo A',
    gasolina98:    'Precio Gasolina 98 E5',
    gasoilPremium: 'Precio Gasoil Premium',
  };

  const mapeadas = gasolineras.map(g => {
    const latStr = g.Latitud?.replace(',', '.') ?? '0';
    const lngStr = (g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.');
    const distancia = this.geo.calcularDistanciaKm(
      posicion.lat, posicion.lng, parseFloat(latStr), parseFloat(lngStr)
    );
    return { ...g, distancia, abierta: this.estaAbierta(g.Horario) };
  });

  const filtradas = mapeadas.filter(g => {
    const dentroRadio = (g.distancia ?? 999) <= filtros.radioKm;
    const marcaOk = filtros.marcas.length === 0 || filtros.marcas.includes(g['Rótulo']);
    const precioStr = g[camposPrecio[filtros.carburante]] as string;
    const tienePrecio = precioStr && precioStr.trim() !== '';
    return dentroRadio && marcaOk && tienePrecio;
  });

  filtradas.sort((a, b) => {
    if (orden === 'distancia') {
      return (a.distancia ?? 999) - (b.distancia ?? 999);
    }
    if (orden === 'nombre') {
      return (a['Rótulo'] ?? '').localeCompare(b['Rótulo'] ?? '');
    }
    // precio (default)
    const campo = camposPrecio[filtros.carburante];
    const pa = parseFloat((a[campo] as string)?.replace(',', '.')) || 9999;
    const pb = parseFloat((b[campo] as string)?.replace(',', '.')) || 9999;
    return pa - pb;
  });

  return filtradas.slice(0, 20);

}

  private estaAbierta(horario: string): boolean {
    if (!horario || horario.includes('24H')) return true;
    const ahora = new Date();
    const dia = ahora.getDay();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    if (dia >= 1 && dia <= 5) return horaActual >= 420 && horaActual <= 1320;
    if (dia === 6) return horaActual >= 480 && horaActual <= 1260;
    return false;
  }
}