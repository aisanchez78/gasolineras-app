import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuscadorComponent } from './components/buscador/buscador.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { ResultadosComponent } from './components/resultados/resultados.component';
import { MapaComponent } from './components/mapa/mapa.component';
import { ComparadorComponent } from './components/comparador/comparador.component';
import { GasolineraService } from './services/gasolinera.service';
import { Gasolinera, GasolineraAPI, ActiveFilters, Coordinates, SortOrder } from './models/gasolinera.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BuscadorComponent, FiltrosComponent, ResultadosComponent, MapaComponent, ComparadorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private svc = inject(GasolineraService);

  readonly userLocation   = signal<Coordinates | null>(null);
  readonly filters        = signal<ActiveFilters>({ fuelType: 'gasolina95', radiusKm: 10, brands: [] });
  readonly order          = signal<SortOrder>('price');
  readonly loading        = signal(false);
  readonly hasSearched    = signal(false);
  readonly comparisonSelection = signal<Gasolinera[]>([]);
  readonly routeTarget    = signal<Gasolinera | null>(null);
  readonly mobileTab      = signal<'list' | 'map'>('list');
  readonly theme          = signal<'dark' | 'light'>('dark');

  private allStations        = signal<GasolineraAPI[]>([]);
  private enrichedCandidates = signal<Gasolinera[]>([]);
  readonly filteredStations  = computed(() =>
    this.svc.sortAndLimit(this.enrichedCandidates(), this.order(), this.filters().fuelType)
  );

  toggleTheme() {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', this.theme());
  }

  onLocationDetected(pos: Coordinates) { this.userLocation.set(pos); this.search(); }

  onFiltersChanged(f: ActiveFilters) { this.filters.set(f); if (this.userLocation()) this.applyFilters(); }

  onRouteSelected(g: Gasolinera) {
    this.routeTarget.update(t => t?.id === g.id ? null : g);
  }

  onOrderChanged(o: SortOrder) {
    this.order.set(o);
  }

  private search() {
    if (!this.userLocation()) return;
    this.loading.set(true);

    if (this.allStations().length > 0) { this.applyFilters(); return; }

    this.svc.fetchAllStations().subscribe({
      next: data => { this.allStations.set(data); this.applyFilters(); },
      error: () => { this.loading.set(false); this.hasSearched.set(true); },
    });
  }

  onToggleComparison(g: Gasolinera) {
    const current = this.comparisonSelection();
    const idx = current.findIndex(s => s.id === g.id);
    if (idx >= 0) {
      this.comparisonSelection.set(current.filter((_, i) => i !== idx));
    } else if (current.length < 3) {
      this.comparisonSelection.set([...current, g]);
    }
  }

  onRemoveFromComparison(g: Gasolinera) {
    this.comparisonSelection.update(list => list.filter(s => s.id !== g.id));
  }

  onClearComparison() {
    this.comparisonSelection.set([]);
  }

  private applyFilters() {
    const loc = this.userLocation();
    if (!loc) return;
    const candidates = this.svc.filterCandidates(this.allStations(), loc, this.filters());
    this.svc.enrichWithRealDistances(candidates, loc).subscribe({
      next: enriched => {
        this.enrichedCandidates.set(enriched);
        this.loading.set(false);
        this.hasSearched.set(true);
      },
      error: () => { this.loading.set(false); this.hasSearched.set(true); },
    });
  }
}
