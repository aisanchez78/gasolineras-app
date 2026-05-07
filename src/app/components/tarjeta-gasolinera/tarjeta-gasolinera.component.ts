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
    return this.station.prices[this.filters?.fuelType] || '—';
  }

  openInMaps() {
    window.open(`https://www.google.com/maps?q=${this.station.lat},${this.station.lng}`, '_blank');
  }
}
