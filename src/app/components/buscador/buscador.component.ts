import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeoService } from '../../services/geo.service';
import { Coordenadas } from '../../models/gasolinera.model';

@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador.component.html',
  styleUrl: './buscador.component.scss'
})
export class BuscadorComponent {
  @Output() posicionDetectada = new EventEmitter<Coordenadas>();

  private geo = inject(GeoService);

  textoBusqueda = '';
  codigoPostal = '';
  nombreLugar = '';
  cargando = false;
  error = '';

  buscarPorCP() {
    if (this.codigoPostal.length < 5) return;
    this.iniciarBusqueda();
    this.geo.buscarDireccion(this.codigoPostal + ', España').subscribe({
      next: r => this.onExito(r),
      error: () => this.onError('No se encontró ese código postal.')
    });
  }

  buscarPorDireccion() {
    if (!this.textoBusqueda.trim()) {
      this.error = 'Escribe una dirección o ciudad.';
      return;
    }
    this.iniciarBusqueda();
    this.geo.buscarDireccion(this.textoBusqueda).subscribe({
      next: r => this.onExito(r),
      error: () => this.onError('No se encontró esa dirección. Intenta con otro término.')
    });
  }

  usarGPS() {
    this.iniciarBusqueda();
    this.geo.obtenerPosicion().subscribe({
      next: pos => {
        this.cargando = false;
        this.nombreLugar = `Tu ubicación (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`;
        this.posicionDetectada.emit(pos);
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

  private iniciarBusqueda() {
    this.cargando = true;
    this.error = '';
    this.nombreLugar = '';
  }

  private onExito(r: { lat: number; lng: number; nombreLugar: string }) {
    this.cargando = false;
    this.nombreLugar = r.nombreLugar;
    this.posicionDetectada.emit({ lat: r.lat, lng: r.lng });
  }

  private onError(msg: string) {
    this.cargando = false;
    this.error = msg;
  }
}