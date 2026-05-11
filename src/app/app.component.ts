import { Component, inject, signal, computed, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuscadorComponent } from './components/buscador/buscador.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { ResultadosComponent } from './components/resultados/resultados.component';
import { MapaComponent } from './components/mapa/mapa.component';
import { ComparadorComponent } from './components/comparador/comparador.component';
import { GasolineraService } from './services/gasolinera.service';
import { Gasolinera, GasolineraAPI, ActiveFilters, Coordinates, SortOrder, FuelType, FUEL_LABELS } from './models/gasolinera.model';

export type ThemePreference = 'dark' | 'light' | 'system';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BuscadorComponent, FiltrosComponent, ResultadosComponent, MapaComponent, ComparadorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private svc = inject(GasolineraService);

  readonly userLocation        = signal<Coordinates | null>(null);
  readonly filters             = signal<ActiveFilters>({ fuelType: 'gasolina95', radiusKm: 10, brands: [], brandMode: 'allow' });
  readonly order               = signal<SortOrder>('price');
  readonly loading             = signal(false);
  readonly hasSearched         = signal(false);
  readonly comparisonSelection  = signal<Gasolinera[]>([]);
  readonly routeTarget          = signal<Gasolinera | null>(null);
  readonly highlightedStation   = signal<Gasolinera | null>(null);
  readonly mobileTab           = signal<'search' | 'list' | 'map'>('search');

  // ── Theme ─────────────────────────────────────────────────────────────────
  private readonly systemDark  = signal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  readonly themePreference     = signal<ThemePreference>(this.loadThemePreference());
  readonly theme               = computed<'dark' | 'light'>(() =>
    this.themePreference() === 'system'
      ? (this.systemDark() ? 'dark' : 'light')
      : this.themePreference() as 'dark' | 'light'
  );
  themeMenuOpen = false;

  readonly themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'dark',   label: 'Oscuro'  },
    { value: 'light',  label: 'Claro'   },
    { value: 'system', label: 'Sistema' },
  ];

  constructor() {
    // Apply resolved theme immediately to prevent flash before Angular renders
    document.documentElement.setAttribute('data-theme', this.theme());
  }

  ngOnInit() {
    // Keep systemDark in sync when OS preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      this.systemDark.set(e.matches);
      if (this.themePreference() === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  // ── Theme menu ────────────────────────────────────────────────────────────

  toggleThemeMenu() { this.themeMenuOpen = !this.themeMenuOpen; }
  closeThemeMenu()  { this.themeMenuOpen = false; }

  @HostListener('document:keydown.escape')
  onEscape() { this.themeMenuOpen = false; }

  setTheme(pref: ThemePreference) {
    this.themeMenuOpen = false;
    if (this.themePreference() === pref) return;

    localStorage.setItem('gasolinapp_theme', pref);

    const resolved: 'dark' | 'light' = pref === 'system'
      ? (this.systemDark() ? 'dark' : 'light')
      : pref as 'dark' | 'light';

    const apply = () => {
      this.themePreference.set(pref);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    if (!this.vtSupported()) { apply(); return; }

    const vt = (document as any).startViewTransition(async () => {
      apply();
      await this.vtFlush();
    });

    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: ['circle(0% at calc(100% - 3rem) 3rem)', 'circle(150% at calc(100% - 3rem) 3rem)'] },
        { pseudoElement: '::view-transition-new(root)', duration: 500, easing: 'ease-in-out' }
      );
    });
  }

  private loadThemePreference(): ThemePreference {
    const stored = localStorage.getItem('gasolinapp_theme');
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    return 'system'; // default: respect OS preference
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private allStations        = signal<GasolineraAPI[]>([]);
  private enrichedCandidates = signal<Gasolinera[]>([]);

  readonly filteredStations = computed(() =>
    this.svc.sortAndLimit(this.enrichedCandidates(), this.order(), this.filters().fuelType)
  );
  readonly availableBrands = computed(() => {
    const loc = this.userLocation();
    if (!loc || !this.allStations().length) return [];
    // Ignore active brand selection so chips never shrink when filtering
    const pool = this.svc.filterCandidates(this.allStations(), loc, { ...this.filters(), brands: [] });
    return [...new Set(pool.map(g => g.name.toUpperCase()))].sort();
  });
  readonly availableFuelTypes = computed(() =>
    (Object.keys(FUEL_LABELS) as FuelType[]).filter(type =>
      this.enrichedCandidates().some(g => g.prices[type] !== '')
    )
  );

  // ── Tab navigation ────────────────────────────────────────────────────────

  setMobileTab(tab: 'search' | 'list' | 'map') {
    if (!this.vtSupported() || window.innerWidth > 768) { this.mobileTab.set(tab); return; }
    const order: Record<'search' | 'list' | 'map', number> = { search: 0, list: 1, map: 2 };
    const dir = order[tab] >= order[this.mobileTab()] ? 'forward' : 'back';
    document.documentElement.setAttribute('data-vt-dir', dir);
    (document as any).startViewTransition(async () => {
      this.mobileTab.set(tab);
      await this.vtFlush();
    }).finished.then(() => document.documentElement.removeAttribute('data-vt-dir'));
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onLocationDetected(pos: Coordinates) {
    this.userLocation.set(pos);
    this.highlightedStation.set(null);
    this.search();
    if (window.innerWidth <= 768) this.setMobileTab('list');
  }

  onFiltersChanged(f: ActiveFilters) { this.filters.set(f); this.highlightedStation.set(null); if (this.userLocation()) this.applyFilters(); }
  onOrderChanged(o: SortOrder)       { this.order.set(o); }
  onRouteSelected(g: Gasolinera)     { this.routeTarget.update(t => t?.id === g.id ? null : g); }
  onStationSelected(g: Gasolinera) {
    this.highlightedStation.update(h => h?.id === g.id ? null : g);
    this.routeTarget.set(null);
  }
  onMapStationHighlighted(g: Gasolinera) {
    this.highlightedStation.set(g);
    this.routeTarget.set(null);
  }

  onToggleComparison(g: Gasolinera) {
    const current = this.comparisonSelection();
    const idx = current.findIndex(s => s.id === g.id);
    if (idx >= 0) this.comparisonSelection.set(current.filter((_, i) => i !== idx));
    else if (current.length < 3) this.comparisonSelection.set([...current, g]);
  }

  onRemoveFromComparison(g: Gasolinera) { this.comparisonSelection.update(l => l.filter(s => s.id !== g.id)); }
  onClearComparison()                   { this.comparisonSelection.set([]); }

  // ── Internals ─────────────────────────────────────────────────────────────

  private search() {
    if (!this.userLocation()) return;
    this.loading.set(true);
    if (this.allStations().length > 0) { this.applyFilters(); return; }
    this.svc.fetchAllStations().subscribe({
      next:  data => { this.allStations.set(data); this.applyFilters(); },
      error: ()   => { this.loading.set(false); this.hasSearched.set(true); },
    });
  }

  private applyFilters() {
    const loc = this.userLocation();
    if (!loc) return;
    const candidates = this.svc.filterCandidates(this.allStations(), loc, this.filters());
    this.svc.enrichWithRealDistances(candidates, loc).subscribe({
      next:  enriched => { this.enrichedCandidates.set(enriched); this.loading.set(false); this.hasSearched.set(true); },
      error: ()        => { this.loading.set(false); this.hasSearched.set(true); },
    });
  }

  private vtSupported(): boolean {
    return 'startViewTransition' in document
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private vtFlush(): Promise<void> { return new Promise(r => setTimeout(r, 0)); }
}
