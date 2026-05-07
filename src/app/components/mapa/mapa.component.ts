import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ElementRef, AfterViewInit, inject, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { Gasolinera, Coordinates, ActiveFilters, FuelType } from '../../models/gasolinera.model';
import { OsrmService } from '../../services/osrm.service';
import { environment } from '../../../environments/environment';

const TILE_DARK  = environment.tileUrlDark;
const TILE_LIGHT = environment.tileUrlLight;
const TILE_ATTR  = environment.tileAttribution;

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

function crearIconoGasolinera(isOpen: boolean, selected: boolean): L.DivIcon {
  const color  = selected ? '#ff5f1f' : (isOpen ? '#16a34a' : '#dc2626');
  const shadow = selected ? 'rgba(255,95,31,.5)' : (isOpen ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.35)');

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
  @Input() stations: Gasolinera[] = [];
  @Input() location: Coordinates | null = null;
  @Input() filters!: ActiveFilters;
  @Input() routeTarget: Gasolinera | null = null;
  @Input() comparisonSelection: Gasolinera[] = [];
  @Input() theme: 'dark' | 'light' = 'dark';

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
    if (changes['stations'] || changes['location'] || changes['comparisonSelection']) this.updateMarkers();
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

    this.markerUsuario = L.marker([this.location.lat, this.location.lng], { icon: iconUsuario })
      .addTo(this.map)
      .bindPopup('<strong>Tu ubicación</strong>');

    const bounds: [number, number][] = [[this.location.lat, this.location.lng]];

    for (const g of this.stations) {
      const lat = g.lat;
      const lng = g.lng;
      if (!lat || !lng) continue;

      const price    = g.prices[this.filters?.fuelType as FuelType] || '—';
      const distance = g.distance.toFixed(1);

      const dark     = this.theme === 'dark';
      const popBg    = dark ? '#1a1a22'                : '#ffffff';
      const popText  = dark ? '#f0ede8'                : '#1a1a1a';
      const popSub   = dark ? 'rgba(255,255,255,.55)'  : 'rgba(0,0,0,.5)';
      const btnBg    = dark ? 'rgba(255,255,255,.08)'  : 'rgba(0,0,0,.06)';
      const btnBdr   = dark ? 'rgba(255,255,255,.15)'  : 'rgba(0,0,0,.12)';
      const btnClr   = dark ? '#f0ede8'                : '#333';
      const btnAccBg  = dark ? 'rgba(255,95,31,.15)'   : 'rgba(255,95,31,.1)';
      const btnAccBdr = dark ? 'rgba(255,95,31,.4)'    : 'rgba(255,95,31,.35)';
      const btnAccClr = dark ? '#ff9500'               : '#d94800';

      const statusHtml = g.isOpen
        ? `<span style="color:${dark ? '#22c55e' : '#16a34a'}">● Abierta</span>`
        : `<span style="color:${dark ? '#ef4444' : '#dc2626'}">● Cerrada</span>`;

      const BTN = `padding:5px 10px;border-radius:7px;font-family:'DM Sans',system-ui;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;`;

      const popup = `<div style="font-family:'DM Sans',system-ui;min-width:180px;font-size:13px;color:${popText};background:${popBg};margin:-13px -20px;padding:14px 16px;border-radius:12px;">
  <strong style="font-family:'Syne',sans-serif;font-size:14px;color:${popText}">${g.name}</strong><br>
  <small style="color:${popSub}">${g.address}, ${g.city}</small><br>
  <div style="margin:6px 0 2px">${statusHtml}</div>
  <div style="font-size:20px;font-weight:800;margin:4px 0;color:${popText}">${price} <span style="font-size:12px;font-weight:400;color:${popSub}">€/L</span></div>
  <small style="color:${popSub}">📍 ${distance} km</small>
  <div style="display:flex;gap:5px;margin-top:10px">
    <button data-accion="ruta" style="${BTN}background:${btnAccBg};border:1px solid ${btnAccBdr};color:${btnAccClr};">🚗 Ruta</button>
    <button data-accion="comparar" style="${BTN}background:${btnBg};border:1px solid ${btnBdr};color:${btnClr};">+ Comparar</button>
    <button data-accion="maps" style="${BTN}background:${btnBg};border:1px solid ${btnBdr};color:${btnClr};">Maps ↗</button>
  </div>
</div>`;

      const isSel = this.comparisonSelection.some(s => s.id === g.id);
      const marker = L.marker([lat, lng], { icon: crearIconoGasolinera(g.isOpen, isSel) })
        .addTo(this.map!)
        .bindPopup(popup);

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

    if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      this.map.setView([this.location.lat, this.location.lng], 13);
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
        style: { color: '#ff5f1f', weight: 5, opacity: 0.8 },
      }).addTo(this.map);

      const km = (route.distanceMeters / 1000).toFixed(1);
      const min = Math.round(route.durationSeconds / 60);

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
}
