import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TarjetaGasolineraComponent } from '../tarjeta-gasolinera/tarjeta-gasolinera.component';
import { Gasolinera, FiltrosActivos, OrdenResultados } from '../../models/gasolinera.model';

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [CommonModule, TarjetaGasolineraComponent],
  templateUrl: './resultados.component.html',
  styleUrl: './resultados.component.scss'
})
export class ResultadosComponent {
  @Input() gasolineras: Gasolinera[] = [];
  @Input() filtros!: FiltrosActivos;
  @Input() orden: OrdenResultados = 'precio';
  @Input() cargando = false;
  @Input() busquedaRealizada = false;
  @Output() ordenChanged = new EventEmitter<OrdenResultados>();
  @Output() seleccionarRuta = new EventEmitter<Gasolinera>();

  opciones: { valor: OrdenResultados; etiqueta: string; icono: string }[] = [
    { valor: 'precio',    etiqueta: 'Precio',    icono: '💰' },
    { valor: 'distancia', etiqueta: 'Distancia', icono: '📍' },
    { valor: 'nombre',    etiqueta: 'Nombre',    icono: '🔤' },
  ];
}