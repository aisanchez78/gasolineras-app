import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gasolinera, ActiveFilters } from '../../models/gasolinera.model';
import { StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-tarjeta-gasolinera',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './tarjeta-gasolinera.component.html',
  styleUrl: './tarjeta-gasolinera.component.scss'
})
export class TarjetaGasolineraComponent {
  @Input() station!: Gasolinera;
  @Input() filters!: ActiveFilters;
  @Input() isCheapest = false;
  @Input() isInComparison = false;
  @Input() isComparisonFull = false;
  @Output() toggleComparison = new EventEmitter<void>();
  @Output() routeSelected = new EventEmitter<void>();

  get highlightedPrice(): string {
    const prices: Record<string, string> = {
      gasolina95:    this.station['Precio Gasolina 95 E5'],
      gasoil:        this.station['Precio Gasoleo A'],
      gasolina98:    this.station['Precio Gasolina 98 E5'],
      gasoilPremium: this.station['Precio Gasoil Premium'],
    };
    return prices[this.filters?.fuelType] || '—';
  }

  openInMaps() {
    const lat = this.station.Latitud?.replace(',', '.') ?? '0';
    const lng = (this.station['Longitud (WGS84)'] ?? this.station.Longitud ?? '0').replace(',', '.');
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }
}
