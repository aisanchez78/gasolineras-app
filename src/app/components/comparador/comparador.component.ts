import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gasolinera, ActiveFilters } from '../../models/gasolinera.model';

type PriceField = 'Precio Gasolina 95 E5' | 'Precio Gasoleo A' | 'Precio Gasolina 98 E5' | 'Precio Gasoil Premium';

const ROWS: { label: string; field: PriceField }[] = [
  { label: 'G95',       field: 'Precio Gasolina 95 E5' },
  { label: 'Gasóleo A', field: 'Precio Gasoleo A' },
  { label: 'G98',       field: 'Precio Gasolina 98 E5' },
  { label: 'Gasoil P.', field: 'Precio Gasoil Premium' },
];

@Component({
  selector: 'app-comparador',
  standalone: true,
  imports: [CommonModule],
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

  getPrice(g: Gasolinera, field: PriceField): string {
    return (g[field] as string)?.trim() || '—';
  }

  private parse(s: string): number {
    if (!s || s.trim() === '' || s === '—') return Infinity;
    return parseFloat(s.replace(',', '.'));
  }

  isBestPrice(g: Gasolinera, field: PriceField): boolean {
    const val = this.parse(g[field] as string);
    if (val === Infinity) return false;
    const min = Math.min(...this.comparisonSelection.map(s => this.parse(s[field] as string)));
    return val === min;
  }

  isBestDistance(g: Gasolinera): boolean {
    const min = Math.min(...this.comparisonSelection.map(s => s.distance ?? Infinity));
    return (g.distance ?? Infinity) === min;
  }

  fuelLabel(): string {
    const map: Record<string, string> = {
      gasolina95: 'G95', gasoil: 'Gasóleo A', gasolina98: 'G98', gasoilPremium: 'Gasoil P.',
    };
    return map[this.filters?.fuelType] ?? '';
  }
}
