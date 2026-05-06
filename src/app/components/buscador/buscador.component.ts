import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeoService } from '../../services/geo.service';
import { Coordinates } from '../../models/gasolinera.model';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.scss'
})
export class BuscadorComponent {
  @Output() locationDetected = new EventEmitter<Coordinates>();

  private geo = inject(GeoService);

  searchText = '';
  postalCode = '';
  locationName = '';
  loading = false;
  error = '';

  searchByPostalCode() {
    if (this.postalCode.length < 5) return;
    this.startSearch();
    this.geo.geocodeAddress(this.postalCode + ', España').subscribe({
      next: r => this.onSuccess(r),
      error: () => this.onError('No se encontró ese código postal.')
    });
  }

  searchByAddress() {
    if (!this.searchText.trim()) {
      this.error = 'Escribe una dirección o ciudad.';
      return;
    }
    this.startSearch();
    this.geo.geocodeAddress(this.searchText).subscribe({
      next: r => this.onSuccess(r),
      error: () => this.onError('No se encontró esa dirección. Intenta con otro término.')
    });
  }

  useGps() {
    this.startSearch();
    this.geo.obtenerPosicion().subscribe({
      next: pos => {
        this.loading = false;
        this.locationName = `Tu ubicación (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`;
        this.locationDetected.emit(pos);
      },
      error: (err) => {
        switch (err?.code) {
          case 1: this.onError('Permiso denegado. Permite el acceso a la ubicación en tu navegador.'); break;
          case 2: this.onError('No se pudo obtener la ubicación GPS.'); break;
          case 3: this.onError('Tiempo de espera agotado. Inténtalo de nuevo.'); break;
          default: this.onError('No se pudo obtener la ubicación.');
        }
      }
    });
  }

  private startSearch() {
    this.loading = true;
    this.error = '';
    this.locationName = '';
  }

  private onSuccess(r: { lat: number; lng: number; locationName: string }) {
    this.loading = false;
    this.locationName = r.locationName;
    this.locationDetected.emit({ lat: r.lat, lng: r.lng });
  }

  private onError(msg: string) {
    this.loading = false;
    this.error = msg;
  }
}
