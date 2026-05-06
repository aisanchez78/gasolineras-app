import { Component, Input, OnChanges, OnDestroy, ElementRef, AfterViewInit, inject, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { Gasolinera, Coordenadas, FiltrosActivos } from '../../models/gasolinera.model';
import { OsrmService } from '../../services/osrm.service';

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

function crearIconoGasolinera(abierta: boolean, seleccionada: boolean): L.DivIcon {
  const color  = seleccionada ? '#ff5f1f' : (abierta ? '#16a34a' : '#dc2626');
  const shadow = seleccionada ? 'rgba(255,95,31,.5)' : (abierta ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.35)');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C16 0 16 0 16 0L16 0C16 0 2 12 2 22c0 8 6.3 14 14 14s14-6 14-14C30 12 16 0 16 0z"
      fill="${color}" stroke="white" stroke-width="2"/>
    <g transform="translate(8,12) scale(0.7)">
      <rect x="1" y="4" width="14" height="16" rx="2" fill="none" stroke="white" stroke-width="2"/>
      <rect x="4" y="7" width="8" height="5" rx="1" fill="white" opacity=".6"/>
      <path d="M17 8l3-3 0 12a2 2 0 0 1-4 0l0-4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <circle cx="18" cy="5" r="1.5" fill="white" opacity=".6"/>
    </g>
  </svg>`;

  return L.divIcon({
    className: 'gas-marker',
    html: `<div style="filter:drop-shadow(0 2px 6px ${shadow});transform:translate(-50%,-100%);position:relative;">${svg}</div>`,
    iconSize:   [0, 0],
    iconAnchor: [0, 0],
  });
}

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
  @Input() seleccionadas: Gasolinera[] = [];

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
    if (changes['gasolineras'] || changes['posicion'] || changes['seleccionadas']) this.actualizarMarcadores();
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

      const isSel = this.seleccionadas.some(s => s.IDEESS === g.IDEESS);
      const marker = L.marker([lat, lng], { icon: crearIconoGasolinera(g.abierta ?? false, isSel) })
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
