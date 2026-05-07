import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TarjetaGasolineraComponent } from '../tarjeta-gasolinera/tarjeta-gasolinera.component';
import { ChipButtonComponent } from '../shared/chip-button/chip-button.component';
import { Gasolinera, ActiveFilters, SortOrder } from '../../models/gasolinera.model';

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [CommonModule, TarjetaGasolineraComponent, ChipButtonComponent],
  templateUrl: './resultados.component.html',
  styleUrl: './resultados.component.scss'
})
export class ResultadosComponent {
  @Input() stations: Gasolinera[] = [];
  @Input() filters!: ActiveFilters;
  @Input() order: SortOrder = 'price';
  @Input() loading = false;
  @Input() hasSearched = false;
  @Input() comparisonSelection: Gasolinera[] = [];
  @Output() orderChanged = new EventEmitter<SortOrder>();
  @Output() toggleComparison = new EventEmitter<Gasolinera>();
  @Output() routeSelected = new EventEmitter<Gasolinera>();

  opciones: { value: SortOrder; label: string; icon: string }[] = [
    { value: 'price',    label: 'Precio',    icon: '💰' },
    { value: 'distance', label: 'Distancia', icon: '📍' },
    { value: 'name',     label: 'Nombre',    icon: '🔤' },
  ];

  isSelected(g: Gasolinera): boolean {
    return this.comparisonSelection.some(s => s.id === g.id);
  }

  get isComparisonFull(): boolean {
    return this.comparisonSelection.length >= 3;
  }
}
