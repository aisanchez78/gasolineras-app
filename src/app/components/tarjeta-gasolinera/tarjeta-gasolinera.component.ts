import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gasolinera, FiltrosActivos } from '../../models/gasolinera.model';

@Component({
  selector: 'app-tarjeta-gasolinera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarjeta-gasolinera.component.html',
  styleUrl: './tarjeta-gasolinera.component.scss'
})
export class TarjetaGasolineraComponent {
  @Input() gasolinera!: Gasolinera;
  @Input() filtros!: FiltrosActivos;
  @Input() esMasBarata = false;
  @Input() enComparacion = false;
  @Input() comparacionLlena = false;
  @Output() toggleComparacion = new EventEmitter<void>();

  get precioDestacado(): string {
    const precios: Record<string, string> = {
      gasolina95:    this.gasolinera['Precio Gasolina 95 E5'],
      gasoil:        this.gasolinera['Precio Gasoleo A'],
      gasolina98:    this.gasolinera['Precio Gasolina 98 E5'],
      gasoilPremium: this.gasolinera['Precio Gasoil Premium'],
    };
    return precios[this.filtros?.carburante] || '—';
  }

  abrirEnMaps() {
    const lat = this.gasolinera.Latitud?.replace(',', '.') ?? '0';
    const lng = (this.gasolinera['Longitud (WGS84)'] ?? this.gasolinera.Longitud ?? '0').replace(',', '.');
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  }
}