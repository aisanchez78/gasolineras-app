import { Component, Output, EventEmitter, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GeoService, GeoSuggestion } from '../../services/geo.service';
import { Coordinates } from '../../models/gasolinera.model';

const CACHE_KEY = 'gasolinapp_location';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.scss',
})
export class BuscadorComponent implements OnInit, OnDestroy {
  @Output() locationDetected = new EventEmitter<Coordinates>();

  private geo = inject(GeoService);

  searchText   = '';
  postalCode   = '';
  locationName = '';
  loading      = false;
  error        = '';

  suggestions     : GeoSuggestion[] = [];
  showSuggestions = false;
  gpsPermission   : PermissionState | 'unsupported' = 'prompt';

  private searchInput$ = new Subject<string>();
  private subs         = new Subscription();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    this.checkGpsPermission();
    this.tryLoadCache();
    this.subs.add(
      this.searchInput$.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => this.geo.searchSuggestions(q)),
      ).subscribe(s => {
        this.suggestions     = s;
        this.showSuggestions = s.length > 0;
      })
    );
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  // ── Permisos GPS ─────────────────────────────────────────────────────────

  private checkGpsPermission() {
    if (!('permissions' in navigator)) { this.gpsPermission = 'unsupported'; return; }
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(result => {
        this.gpsPermission    = result.state;
        result.onchange = () => { this.gpsPermission = result.state; };
      })
      .catch(() => { this.gpsPermission = 'unsupported'; });
  }

  // ── Caché localStorage ───────────────────────────────────────────────────

  private tryLoadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { lat, lng, locationName, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return; }
      this.locationName = locationName;
      this.locationDetected.emit({ lat, lng });
    } catch { /* localStorage no disponible o datos corruptos */ }
  }

  private saveCache(lat: number, lng: number, name: string) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng, locationName: name, timestamp: Date.now() }));
    } catch { /* ignore */ }
  }

  // ── Acciones de búsqueda ─────────────────────────────────────────────────

  searchByPostalCode() {
    if (this.postalCode.length < 5) return;
    this.startSearch();
    this.geo.geocodeAddress(this.postalCode + ', España').subscribe({
      next:  r => this.onSuccess(r),
      error: () => this.onError('No se encontró ese código postal.'),
    });
  }

  searchByAddress() {
    if (!this.searchText.trim()) { this.error = 'Escribe una dirección o ciudad.'; return; }
    this.startSearch();
    this.geo.geocodeAddress(this.searchText).subscribe({
      next:  r => this.onSuccess(r),
      error: () => this.onError('No se encontró esa dirección. Intenta con otro término.'),
    });
  }

  onSearchInput(value: string) {
    this.searchText = value;
    this.error = '';
    this.searchInput$.next(value);
  }

  selectSuggestion(s: GeoSuggestion) {
    this.searchText     = s.label;
    this.showSuggestions = false;
    this.suggestions    = [];
    this.onSuccess({ lat: s.lat, lng: s.lng, locationName: s.label });
  }

  hideSuggestions() {
    // Retrasamos para que el click en una sugerencia pueda ejecutarse primero
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  useGps() {
    if (this.gpsPermission === 'denied') {
      this.onError('Permiso de ubicación denegado. Permite el acceso en la configuración del navegador.');
      return;
    }
    this.startSearch();
    this.geo.obtenerPosicion().subscribe({
      next: pos => {
        this.geo.reverseGeocode(pos.lat, pos.lng).subscribe({
          next:  name  => this.finalizeGps(pos, name),
          error: ()    => this.finalizeGps(pos, `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`),
        });
      },
      error: err => {
        switch (err?.code) {
          case 1:  this.onError('Permiso denegado. Permite el acceso a la ubicación en tu navegador.'); break;
          case 2:  this.onError('No se pudo obtener la ubicación GPS.'); break;
          case 3:  this.onError('Tiempo de espera agotado. Inténtalo de nuevo.'); break;
          default: this.onError('No se pudo obtener la ubicación.');
        }
      },
    });
  }

  private finalizeGps(pos: Coordinates, name: string) {
    this.loading      = false;
    this.locationName = name;
    this.locationDetected.emit(pos);
    this.saveCache(pos.lat, pos.lng, name);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private startSearch() {
    this.loading         = true;
    this.error           = '';
    this.locationName    = '';
    this.showSuggestions = false;
  }

  private onSuccess(r: { lat: number; lng: number; locationName: string }) {
    this.loading         = false;
    this.locationName    = r.locationName;
    this.showSuggestions = false;
    this.suggestions     = [];
    this.locationDetected.emit({ lat: r.lat, lng: r.lng });
    this.saveCache(r.lat, r.lng, r.locationName);
  }

  private onError(msg: string) {
    this.loading = false;
    this.error   = msg;
  }
}
