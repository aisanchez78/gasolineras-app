import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ElementRef, AfterViewInit, inject, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { Gasolinera, Coordinates, ActiveFilters, FuelType } from '../../models/gasolinera.model';
import { OsrmService } from '../../services/osrm.service';
import { environment } from '../../../environments/environment';

const TILE_DARK  = environment.tileUrlDark;
const TILE_LIGHT = environment.tileUrlLight;
const TILE_ATTR  = environment.tileAttribution;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function crearIconoUsuario(): L.DivIcon {
  const accent     = cssVar('--accent');
  const accentDark = cssVar('--accent-dark');
  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;
      background:radial-gradient(circle,${accent} 0%,${accentDark} 100%);
      border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 10px ${accent}b3;
    "></div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  });
}

function crearIconoGasolinera(isOpen: boolean, selected: boolean, highlighted = false): L.DivIcon {
  const accent = cssVar('--accent');
  const green  = cssVar('--green');
  const red    = cssVar('--red');
  const color  = highlighted ? accent : selected ? accent : (isOpen ? green : red);
  const shadow = highlighted ? `${accent}99` : selected ? `${accent}80` : (isOpen ? `${green}66` : `${red}59`);
  const scale  = highlighted ? 'scale(1.25)' : 'scale(1)';
  const ring   = highlighted
    ? `<div style="position:absolute;inset:-6px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;border:2px solid ${accent};opacity:.6;animation:marker-ring 1.5s ease-out infinite;pointer-events:none;"></div>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C16 0 16 0 16 0L16 0C16 0 2 12 2 22c0 8 6.3 14 14 14s14-6 14-14C30 12 16 0 16 0z"
      fill="${color}" stroke="white" stroke-width="${highlighted ? 2.5 : 2}"/>
    <g transform="translate(8,12) scale(0.7)">
      <rect x="1" y="4" width="14" height="16" rx="2" fill="none" stroke="white" stroke-width="2"/>
      <rect x="4" y="7" width="8" height="5" rx="1" fill="white" opacity=".6"/>
      <path d="M17 8l3-3 0 12a2 2 0 0 1-4 0l0-4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <circle cx="18" cy="5" r="1.5" fill="white" opacity=".6"/>
    </g>
  </svg>`;

  return L.divIcon({
    className: 'gas-marker',
    html: `<div style="filter:drop-shadow(0 2px 8px ${shadow});transform:translate(-50%,-100%) ${scale};position:relative;transform-origin:bottom center;transition:transform .2s;">${ring}${svg}</div>`,
    iconSize:   [0, 0],
    iconAnchor: [0, 0],
  });
}

@Component({
  selector: 'app-mapa',
  standalone: true,
  template: '<div class="mapa-container" #mapaEl></div>',
  styles: [`
    :host { display: block; }
    .mapa-container {
      width: 100%;
      height: 420px;
      border-radius: 20px;
      overflow: hidden;
    }
    @media (max-width: 768px) {
      :host { height: 100%; }
      .mapa-container {
        height: 100%;
        border-radius: 0;
        border: none;
      }
    }
  `],
})
export class MapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() stations: Gasolinera[] = [];
  @Input() location: Coordinates | null = null;
  @Input() filters!: ActiveFilters;
  @Input() routeTarget: Gasolinera | null = null;
  @Input() comparisonSelection: Gasolinera[] = [];
  @Input() highlightedStation: Gasolinera | null = null;
  @Input() theme: 'dark' | 'light' = 'dark';
  /** Set to true when the map tab becomes visible — triggers invalidateSize so tiles render correctly. */
  @Input() set active(v: boolean) {
    if (v && this.map) {
      setTimeout(() => {
        this.map?.invalidateSize();
        this.openHighlightedPopup();
      }, 80);
    }
  }

  @Output() toggleComparison = new EventEmitter<Gasolinera>();

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private markerUsuario: L.Marker | null = null;
  private listo = false;
  private rutaLayer: L.GeoJSON | null = null;
  private panelRuta: L.Control | null = null;
  private tileLayer: L.TileLayer | null = null;
  private activeMarkerStation: Gasolinera | null = null;

  private osrm = inject(OsrmService);

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    const contenedor = this.el.nativeElement.querySelector('.mapa-container');
    this.map = L.map(contenedor).setView([40.416775, -3.70379], 6);
    this.tileLayer = L.tileLayer(this.theme === 'dark' ? TILE_DARK : TILE_LIGHT, {
      attribution: TILE_ATTR,
      maxZoom: 19,
    }).addTo(this.map);
    this.listo = true;
    this.updateMarkers();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.listo) return;
    if (changes['theme']) {
      this.tileLayer?.setUrl(this.theme === 'dark' ? TILE_DARK : TILE_LIGHT);
      this.updateMarkers();
    }
    if (changes['stations'] || changes['location'] || changes['comparisonSelection'] || changes['filters'] || changes['highlightedStation']) this.updateMarkers();
    if (changes['highlightedStation']) this.openHighlightedPopup();
    if (changes['routeTarget']) {
      this.activeMarkerStation = null;
      this.updateRoute();
    }
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private updateMarkers() {
    if (!this.map) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.markerUsuario?.remove();

    if (!this.location) return;

    this.markerUsuario = L.marker([this.location.lat, this.location.lng], { icon: crearIconoUsuario() })
      .addTo(this.map)
      .bindPopup('<strong>Tu ubicación</strong>');

    const bounds: [number, number][] = [[this.location.lat, this.location.lng]];

    for (const g of this.stations) {
      const lat = g.lat;
      const lng = g.lng;
      if (!lat || !lng) continue;

      const priceRaw = g.prices[this.filters?.fuelType as FuelType] || '—';
      const price    = priceRaw !== '—' ? priceRaw.replace('.', ',') : '—';
      const distance = g.distance.toFixed(1);

      const statusHtml = g.isOpen
        ? `<span style="color:var(--green-text)">● Abierta</span>`
        : `<span style="color:var(--red-text)">● Cerrada</span>`;

      const BTN = `padding:6px 14px;border-radius:20px;font-family:'DM Sans',system-ui;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;`;

      const popup = `<div style="font-family:'DM Sans',system-ui;min-width:190px;font-size:13px;color:var(--text-primary);background:var(--bg-3);margin:-13px -20px;padding:16px 18px;border-radius:14px;box-shadow:var(--shadow);">
  <strong style="font-family:'Syne',sans-serif;font-size:15px;color:var(--text-primary)">${g.name}</strong><br>
  <small style="color:var(--text-secondary)">${g.address}, ${g.city}</small><br>
  <div style="margin:7px 0 2px">${statusHtml}</div>
  <div style="font-size:22px;font-weight:800;margin:4px 0;color:var(--text-primary)">${price} <span style="font-size:13px;font-weight:400;color:var(--text-secondary)">€/L</span></div>
  <small style="color:var(--text-secondary)">📍 ${distance} km</small>
  <div style="display:flex;gap:6px;margin-top:12px">
    <button data-accion="ruta" style="${BTN}background:var(--accent-glow);border:1px solid var(--accent-glow);color:var(--accent-2-text);">🚗 Ruta</button>
    <button data-accion="comparar" style="${BTN}background:var(--surface-hover);border:1px solid var(--border-light);color:var(--text-primary);">+ Comparar</button>
    <button data-accion="maps" style="${BTN}background:var(--surface-hover);border:1px solid var(--border-light);color:var(--text-primary);">Maps ↗</button>
  </div>
</div>`;

      const isSel  = this.comparisonSelection.some(s => s.id === g.id);
      const isHl   = this.highlightedStation?.id === g.id;
      const marker = L.marker([lat, lng], { icon: crearIconoGasolinera(g.isOpen, isSel, isHl) })
        .addTo(this.map!)
        .bindPopup(popup, { className: 'gasolinapp-popup' });

      marker.on('popupopen', () => {
        const el = marker.getPopup()?.getElement();
        if (!el) return;
        const btnRuta     = el.querySelector<HTMLElement>('[data-accion="ruta"]');
        const btnComparar = el.querySelector<HTMLElement>('[data-accion="comparar"]');
        const btnMaps     = el.querySelector<HTMLElement>('[data-accion="maps"]');
        if (btnRuta)     L.DomEvent.on(btnRuta,     'click', () => { this.activeMarkerStation = g; this.updateRoute(); });
        if (btnComparar) L.DomEvent.on(btnComparar, 'click', () => this.toggleComparison.emit(g));
        if (btnMaps)     L.DomEvent.on(btnMaps,     'click', () => {
          window.open(`https://www.google.com/maps?q=${g.lat},${g.lng}`, '_blank');
        });
      });

      this.markers.push(marker);
      bounds.push([lat, lng]);
    }

    // Always centre on the user's location so the search origin is always visible.
    // Zoom is derived from the active search radius so all stations fit roughly in view.
    const zoom = this.radiusToZoom(this.filters?.radiusKm ?? 10);
    this.map.setView([this.location.lat, this.location.lng], zoom);
  }

  /** Maps a search-radius (km) to a Leaflet zoom level that shows that radius. */
  private radiusToZoom(radiusKm: number): number {
    if (radiusKm <= 1)  return 14;
    if (radiusKm <= 2)  return 13;
    if (radiusKm <= 5)  return 12;
    if (radiusKm <= 10) return 11;
    if (radiusKm <= 20) return 10;
    if (radiusKm <= 35) return 9;
    return 8;
  }

  private openHighlightedPopup() {
    if (!this.highlightedStation || !this.listo) return;
    const idx = this.stations.findIndex(s => s.id === this.highlightedStation!.id);
    if (idx !== -1 && this.markers[idx]) {
      this.markers[idx].openPopup();
    }
  }

  private updateRoute() {
    this.rutaLayer?.remove();
    this.rutaLayer = null;
    if (this.panelRuta) { this.map?.removeControl(this.panelRuta); this.panelRuta = null; }

    const g = this.activeMarkerStation ?? this.routeTarget;
    if (!g || !this.location || !this.map) return;

    const destination: Coordinates = { lat: g.lat, lng: g.lng };

    this.osrm.getRoute(this.location, destination).subscribe(route => {
      if (!route || !this.map) return;

      this.rutaLayer = L.geoJSON(route.geometry as any, {
        style: { color: cssVar('--accent'), weight: 5, opacity: 0.8 },
      }).addTo(this.map);

      const km = (route.distanceMeters / 1000).toFixed(1);
      const min = Math.round(route.durationSeconds / 60);

      const InfoControl = L.Control.extend({
        onAdd: () => {
          const div = L.DomUtil.create('div');
          div.style.cssText = 'background:var(--bg-2);color:var(--text-primary);padding:.6rem 1rem;border-radius:12px;font-family:sans-serif;font-size:.85rem;border:1px solid var(--accent-glow);box-shadow:var(--shadow);';
          div.innerHTML = `🚗 <strong>${km} km</strong> · ${min} min`;
          return div;
        },
      });
      this.panelRuta = new (InfoControl as any)({ position: 'topright' });
      this.panelRuta!.addTo(this.map);

      const bounds = this.rutaLayer!.getBounds();
      const pad: [number, number] = window.innerWidth <= 768 ? [20, 20] : [40, 40];
      this.map.fitBounds(bounds, { padding: pad });
    });
  }
}
