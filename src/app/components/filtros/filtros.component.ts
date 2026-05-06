import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActiveFilters } from '../../models/gasolinera.model';

@Component({
  selector: 'app-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filtros.component.html',
  styleUrl: './filtros.component.scss'
})
export class FiltrosComponent implements OnInit {
  @Output() filtersChanged = new EventEmitter<ActiveFilters>();

  fuelType: ActiveFilters['fuelType'] = 'gasolina95';
  radiusKm = 10;
  selectedBrands: string[] = [];

  availableBrands = [
    'REPSOL', 'CEPSA', 'BP', 'SHELL', 'GALP', 'CAMPSA', 'PETRONOR',
    'ESSO', 'BALLENOIL', 'PLENOIL', 'CARREFOUR'
  ];

  fuelTypes: { value: ActiveFilters['fuelType']; label: string }[] = [
    { value: 'gasolina95',    label: 'Gasolina 95' },
    { value: 'gasoil',        label: 'Gasoil A' },
    { value: 'gasolina98',    label: 'Gasolina 98' },
    { value: 'gasoilPremium', label: 'Gasoil Premium' },
  ];

  ngOnInit() { this.emit(); }

  toggleBrand(brand: string) {
    const idx = this.selectedBrands.indexOf(brand);
    if (idx === -1) this.selectedBrands.push(brand);
    else this.selectedBrands.splice(idx, 1);
    this.emit();
  }

  isBrandSelected(brand: string): boolean {
    return this.selectedBrands.includes(brand);
  }

  emit() {
    this.filtersChanged.emit({
      fuelType: this.fuelType,
      radiusKm: this.radiusKm,
      brands: this.selectedBrands,
    });
  }
}
