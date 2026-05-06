import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuscadorComponent } from './components/buscador/buscador.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { ResultadosComponent } from './components/resultados/resultados.component';
import { MapaComponent } from './components/mapa/mapa.component';
import { ComparadorComponent } from './components/comparador/comparador.component';
import { GasolineraService } from './services/gasolinera.service';
import { Gasolinera, ActiveFilters, Coordinates, SortOrder } from './models/gasolinera.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BuscadorComponent, FiltrosComponent, ResultadosComponent, MapaComponent, ComparadorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private svc = inject(GasolineraService);
  private cdr = inject(ChangeDetectorRef);

  userLocation: Coordinates | null = null;
  filters: ActiveFilters = { fuelType: 'gasolina95', radiusKm: 10, brands: [] };
  order: SortOrder = 'price';
  allStations: Gasolinera[] = [];
  enrichedCandidates: Gasolinera[] = [];
  filteredStations: Gasolinera[] = [];
  loading = false;
  hasSearched = false;
  comparisonSelection: Gasolinera[] = [];
  routeTarget: Gasolinera | null = null;
  mobileTab: 'list' | 'map' = 'list';
  theme: 'dark' | 'light' = 'dark';

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    this.cdr.detectChanges();
  }

  onLocationDetected(pos: Coordinates) { this.userLocation = pos; this.search(); }

  onFiltersChanged(f: ActiveFilters) { this.filters = f; if (this.userLocation) this.applyFilters(); }

  onRouteSelected(g: Gasolinera) {
    this.routeTarget = this.routeTarget?.IDEESS === g.IDEESS ? null : g;
    this.cdr.detectChanges();
  }

  onOrderChanged(o: SortOrder) {
    this.order = o;
    if (this.enrichedCandidates.length > 0) {
      this.filteredStations = this.svc.sortAndLimit(this.enrichedCandidates, this.order, this.filters.fuelType);
      this.cdr.detectChanges();
    }
  }

  private search() {
    if (!this.userLocation) return;
    this.loading = true;
    this.cdr.detectChanges();

    if (this.allStations.length > 0) { this.applyFilters(); return; }

    this.svc.fetchAllStations().subscribe({
      next: data => { this.allStations = data; this.applyFilters(); },
      error: () => { this.loading = false; this.hasSearched = true; this.cdr.detectChanges(); },
    });
  }

  onToggleComparison(g: Gasolinera) {
    const idx = this.comparisonSelection.findIndex(s => s.IDEESS === g.IDEESS);
    if (idx >= 0) {
      this.comparisonSelection = this.comparisonSelection.filter((_, i) => i !== idx);
    } else if (this.comparisonSelection.length < 3) {
      this.comparisonSelection = [...this.comparisonSelection, g];
    }
    this.cdr.detectChanges();
  }

  onRemoveFromComparison(g: Gasolinera) {
    this.comparisonSelection = this.comparisonSelection.filter(s => s.IDEESS !== g.IDEESS);
    this.cdr.detectChanges();
  }

  onClearComparison() {
    this.comparisonSelection = [];
    this.cdr.detectChanges();
  }

  private applyFilters() {
    if (!this.userLocation) return;
    const candidates = this.svc.filterCandidates(this.allStations, this.userLocation, this.filters);
    this.svc.enrichWithRealDistances(candidates, this.userLocation).subscribe({
      next: enriched => {
        this.enrichedCandidates = enriched;
        this.filteredStations   = this.svc.sortAndLimit(enriched, this.order, this.filters.fuelType);
        this.loading            = false;
        this.hasSearched        = true;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.hasSearched = true; this.cdr.detectChanges(); },
    });
  }
}
