import { Component, Input, OnChanges, OnDestroy, ElementRef, AfterViewInit, inject, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { Gasolinera, Coordenadas, FiltrosActivos } from '../../models/gasolinera.model';
import { OsrmService } from '../../services/osrm.service';

const iconGasolinera = L.icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

const iconUsuario = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;
    background:radial-gradient(circle,#ff5f1f 0%,#d94800 100%);
    border:3px solid #fff;border-radius:50%;
    box-shadow:0 0 10px rgba(255,95,31,.7);
  "></div>`,
  iconSize:   [18, 18],
  iconAnchor: [9, 9],
});

@Component({
  selector: 'app-mapa',
  standalone: true,
  template: '<div class="mapa-container" #mapaEl></div>',
  styles: [`
    .mapa-container {
      width: 100%;
      height: 420px;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.09);
    }
  `],
})
export class MapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() gasolineras: Gasolinera[] = [];
  @Input() posicion: Coordenadas | null = null;
  @Input() filtros!: FiltrosActivos;
  @Input() gasolineraSeleccionada: Gasolinera | null = null;
  @Input() theme: 'dark' | 'light' = 'dark';

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private markerUsuario: L.Marker | null = null;
  private listo = false;
  private rutaLayer: L.GeoJSON | null = null;
  private panelRuta: L.Control | null = null;

  private osrm = inject(OsrmService);

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    const contenedor = this.el.nativeElement.querySelector('.mapa-container');
    this.map = L.map(contenedor).setView([40.416775, -3.70379], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
    this.listo = true;
    this.actualizarMarcadores();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.listo) return;
    if (changes['gasolineras'] || changes['posicion']) this.actualizarMarcadores();
    if (changes['gasolineraSeleccionada']) this.actualizarRuta();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private actualizarMarcadores() {
    if (!this.map) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.markerUsuario?.remove();

    if (!this.posicion) return;

    this.markerUsuario = L.marker([this.posicion.lat, this.posicion.lng], { icon: iconUsuario })
      .addTo(this.map)
      .bindPopup('<strong>Tu ubicación</strong>');

    const bounds: [number, number][] = [[this.posicion.lat, this.posicion.lng]];

    for (const g of this.gasolineras) {
      const lat = parseFloat(g.Latitud?.replace(',', '.') ?? '0');
      const lng = parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.'));
      if (!lat || !lng) continue;

      const precio    = this.precioDestacado(g);
      const distancia = g.distancia?.toFixed(1) ?? '?';
      const estadoHtml = g.abierta
        ? '<span style="color:#86efac">● Abierta</span>'
        : '<span style="color:#fca5a5">● Cerrada</span>';

      const popup = `
        <div style="font-family:sans-serif;min-width:160px">
          <strong style="font-size:.9rem">${g['Rótulo'] || 'Sin nombre'}</strong><br>
          <small style="color:#888">${g['Dirección']}, ${g.Municipio}</small><br><br>
          ${estadoHtml}<br>
          <span style="font-size:1.1rem;font-weight:700">${precio} €/L</span><br>
          <small>📍 ${distancia} km por carretera</small>
        </div>`;

      const marker = L.marker([lat, lng], { icon: iconGasolinera })
        .addTo(this.map!)
        .bindPopup(popup);

      this.markers.push(marker);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      this.map.setView([this.posicion.lat, this.posicion.lng], 13);
    }
  }

  private actualizarRuta() {
    this.rutaLayer?.remove();
    this.rutaLayer = null;
    if (this.panelRuta) { this.map?.removeControl(this.panelRuta); this.panelRuta = null; }

    const g = this.gasolineraSeleccionada;
    if (!g || !this.posicion || !this.map) return;

    const destino: Coordenadas = {
      lat: parseFloat(g.Latitud?.replace(',', '.') ?? '0'),
      lng: parseFloat((g['Longitud (WGS84)'] ?? g.Longitud ?? '0').replace(',', '.')),
    };

    this.osrm.calcularRuta(this.posicion, destino).subscribe(ruta => {
      if (!ruta || !this.map) return;

      this.rutaLayer = L.geoJSON(ruta.geometry as any, {
        style: { color: '#ff5f1f', weight: 5, opacity: 0.8 },
      }).addTo(this.map);

      const km = (ruta.distanciaMetros / 1000).toFixed(1);
      const min = Math.round(ruta.duracionSegundos / 60);

      const InfoControl = L.Control.extend({
        onAdd: () => {
          const div = L.DomUtil.create('div');
          div.style.cssText = 'background:rgba(13,13,15,.95);color:#f0ede8;padding:.6rem 1rem;border-radius:12px;font-family:sans-serif;font-size:.85rem;border:1px solid rgba(255,95,31,.4);';
          div.innerHTML = `🚗 <strong>${km} km</strong> · ${min} min`;
          return div;
        },
      });
      this.panelRuta = new (InfoControl as any)({ position: 'topright' });
      this.panelRuta!.addTo(this.map);

      const bounds = this.rutaLayer!.getBounds();
      this.map.fitBounds(bounds, { padding: [40, 40] });
    });
  }

  private precioDestacado(g: Gasolinera): string {
    const precios: Record<string, string> = {
      gasolina95:    g['Precio Gasolina 95 E5'],
      gasoil:        g['Precio Gasoleo A'],
      gasolina98:    g['Precio Gasolina 98 E5'],
      gasoilPremium: g['Precio Gasoil Premium'],
    };
    return precios[this.filtros?.carburante] || '—';
  }
}
