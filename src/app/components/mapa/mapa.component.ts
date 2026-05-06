import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, ElementRef, AfterViewInit, inject, SimpleChanges } from '@angular/core';
import * as L from 'leaflet';
import { Gasolinera, Coordenadas, FiltrosActivos } from '../../models/gasolinera.model';
import { OsrmService } from '../../services/osrm.service';

const BTN_STYLE = 'padding:.35rem .7rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#f0ede8;border-radius:8px;font-family:sans-serif;font-size:.75rem;cursor:pointer;white-space:nowrap;';

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
  @Input() seleccionadas: Gasolinera[] = [];
  @Output() toggleComparacion = new EventEmitter<Gasolinera>();

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private markerGasolineraMap = new Map<L.Marker, Gasolinera>();
  private markerUsuario: L.Marker | null = null;
  private listo = false;
  private rutaLayer: L.GeoJSON | null = null;
  private panelRuta: L.Control | null = null;
  // Gasolinera activada desde el popup del mapa (tiene prioridad sobre el @Input de la tarjeta)
  private gasolineraActivaEnMapa: Gasolinera | null = null;

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
    if (changes['gasolineraSeleccionada']) {
      this.gasolineraActivaEnMapa = null; // la tarjeta toma el control
      this.actualizarRuta();
    }
    if (changes['seleccionadas']) this.refrescarPopupAbierto();
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private actualizarMarcadores() {
    if (!this.map) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    this.markerGasolineraMap.clear();
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

      const precio     = this.precioDestacado(g);
      const distancia  = g.distancia?.toFixed(1) ?? '?';
      const estadoHtml = g.abierta
        ? '<span style="color:#86efac">● Abierta</span>'
        : '<span style="color:#fca5a5">● Cerrada</span>';

      const popup = `
        <div style="font-family:sans-serif;min-width:170px">
          <strong style="font-size:.9rem">${g['Rótulo'] || 'Sin nombre'}</strong><br>
          <small style="color:#888">${g['Dirección']}, ${g.Municipio}</small><br><br>
          ${estadoHtml}<br>
          <span style="font-size:1.1rem;font-weight:700">${precio} €/L</span><br>
          <small>📍 ${distancia} km por carretera</small>
          <div style="display:flex;gap:.4rem;margin-top:.6rem">
            <button data-accion="ruta" style="${BTN_STYLE}">🚗 Ver ruta</button>
            <button data-accion="comparar" style="${BTN_STYLE}">+ Comparar</button>
          </div>
        </div>`;

      const marker = L.marker([lat, lng], { icon: iconGasolinera })
        .addTo(this.map!)
        .bindPopup(popup);

      marker.on('popupopen', () => {
        const popupEl = marker.getPopup()?.getElement();
        if (!popupEl) return;

        // Botón ruta
        const btnRuta = popupEl.querySelector<HTMLElement>('[data-accion="ruta"]');
        if (btnRuta) {
          L.DomEvent.on(btnRuta, 'click', () => {
            this.gasolineraActivaEnMapa = g;
            this.actualizarRuta();
          });
        }

        // Botón comparar — inicializa estado y adjunta handler
        const btnComparar = popupEl.querySelector<HTMLButtonElement>('[data-accion="comparar"]');
        if (btnComparar) {
          this.aplicarEstadoComparar(btnComparar, g);
          L.DomEvent.on(btnComparar, 'click', () => this.toggleComparacion.emit(g));
        }
      });

      this.markers.push(marker);
      this.markerGasolineraMap.set(marker, g);
      bounds.push([lat, lng]);
    }

    if (bounds.length > 1) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      this.map.setView([this.posicion.lat, this.posicion.lng], 13);
    }
  }

  // Actualiza el botón comparar del popup actualmente abierto cuando cambia seleccionadas
  private refrescarPopupAbierto() {
    for (const [marker, g] of this.markerGasolineraMap) {
      if (marker.isPopupOpen()) {
        const btn = marker.getPopup()?.getElement()
          ?.querySelector<HTMLButtonElement>('[data-accion="comparar"]');
        if (btn) this.aplicarEstadoComparar(btn, g);
        break;
      }
    }
  }

  private aplicarEstadoComparar(btn: HTMLButtonElement, g: Gasolinera) {
    const seleccionada = this.seleccionadas.some(s => s.IDEESS === g.IDEESS);
    const llena = this.seleccionadas.length >= 3 && !seleccionada;
    btn.textContent = seleccionada ? '✓ Comparando' : '+ Comparar';
    btn.disabled = llena;
    btn.style.opacity = llena ? '0.4' : '1';
    btn.style.cursor  = llena ? 'not-allowed' : 'pointer';
    if (seleccionada) {
      btn.style.background    = 'rgba(255,95,31,0.25)';
      btn.style.borderColor   = 'rgba(255,95,31,0.6)';
      btn.style.color         = '#ff9500';
    } else {
      btn.style.background    = 'rgba(255,255,255,.08)';
      btn.style.borderColor   = 'rgba(255,255,255,.2)';
      btn.style.color         = '#f0ede8';
    }
  }

  private actualizarRuta() {
    this.rutaLayer?.remove();
    this.rutaLayer = null;
    if (this.panelRuta) { this.map?.removeControl(this.panelRuta); this.panelRuta = null; }

    const g = this.gasolineraActivaEnMapa ?? this.gasolineraSeleccionada;
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

      const km  = (ruta.distanciaMetros / 1000).toFixed(1);
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
      this.map.fitBounds(this.rutaLayer!.getBounds(), { padding: [40, 40] });
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
