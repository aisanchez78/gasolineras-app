import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gasolinera, ActiveFilters, FuelType, FUEL_LABELS } from '../../models/gasolinera.model';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

const ROWS: { label: string; key: FuelType }[] = [
  { label: 'G95',       key: 'gasolina95'    },
  { label: 'Gasóleo A', key: 'gasoil'        },
  { label: 'G98',       key: 'gasolina98'    },
  { label: 'Gasoil P.', key: 'gasoilPremium' },
];

@Component({
  selector: 'app-comparador',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './comparador.component.html',
  styleUrl: './comparador.component.scss',
})
export class ComparadorComponent implements OnChanges {
  @Input() comparisonSelection: Gasolinera[] = [];
  @Input() filters!: ActiveFilters;
  @Output() remove = new EventEmitter<Gasolinera>();
  @Output() clear = new EventEmitter<void>();

  panelOpen = false;
  readonly rows = ROWS;

  ngOnChanges() {
    if (this.comparisonSelection.length === 0) this.panelOpen = false;
  }

  togglePanel() { this.panelOpen = !this.panelOpen; }

  getPrice(g: Gasolinera, key: FuelType): string {
    return g.prices[key] || '—';
  }

  isBestPrice(g: Gasolinera, key: FuelType): boolean {
    const val = parseFloat(g.prices[key]);
    if (isNaN(val)) return false;
    const min = Math.min(...this.comparisonSelection.map(s => parseFloat(s.prices[key]) || Infinity));
    return val === min;
  }

  isBestDistance(g: Gasolinera): boolean {
    const min = Math.min(...this.comparisonSelection.map(s => s.distance));
    return g.distance === min;
  }

  fuelLabel(): string {
    return FUEL_LABELS[this.filters?.fuelType as FuelType] ?? this.filters?.fuelType;
  }
}
