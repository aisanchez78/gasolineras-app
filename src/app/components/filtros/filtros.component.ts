import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FuelType, FUEL_LABELS, ActiveFilters, BrandMode } from '../../models/gasolinera.model';
import { ChipButtonComponent } from '../shared/chip-button/chip-button.component';

@Component({
  selector: 'app-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule, ChipButtonComponent],
  templateUrl: './filtros.component.html',
  styleUrl: './filtros.component.scss'
})
export class FiltrosComponent implements OnInit, OnChanges {
  @Input() availableFuelTypes: FuelType[] = [];
  @Input() availableBrands: string[] = [];
  @Input() hasData = false;
  @Output() filtersChanged = new EventEmitter<ActiveFilters>();

  fuelType: FuelType = 'gasolina95';
  radiusKm = 10;
  selectedBrands: string[] = [];
  brandMode: BrandMode = 'allow';

  get fuelTypes() {
    return this.availableFuelTypes.map(value => ({ value, label: FUEL_LABELS[value] }));
  }

  ngOnInit() { this.emit(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['availableFuelTypes'] && this.availableFuelTypes.length) {
      if (!this.availableFuelTypes.includes(this.fuelType)) {
        this.fuelType = this.availableFuelTypes[0];
        this.emit();
      }
    }
  }

  setBrandMode(mode: BrandMode) {
    if (this.brandMode === mode) return;
    this.brandMode = mode;
    this.selectedBrands = [];
    this.emit();
  }

  toggleBrand(brand: string) {
    const idx = this.selectedBrands.indexOf(brand);
    if (idx === -1) this.selectedBrands.push(brand);
    else this.selectedBrands.splice(idx, 1);
    this.emit();
  }

  isBrandSelected(brand: string): boolean {
    return this.selectedBrands.includes(brand);
  }

  get brandNote(): string {
    if (!this.selectedBrands.length) return '';
    const list = this.selectedBrands.join(', ');
    return this.brandMode === 'allow' ? `Mostrando solo: ${list}` : `Excluyendo: ${list}`;
  }

  clearBrands() {
    this.selectedBrands = [];
    this.emit();
  }

  emit() {
    this.filtersChanged.emit({
      fuelType: this.fuelType,
      radiusKm: this.radiusKm,
      brands: this.selectedBrands,
      brandMode: this.brandMode,
    });
  }
}
