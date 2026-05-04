import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FiltrosActivos } from '../../models/gasolinera.model';

@Component({
  selector: 'app-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filtros.component.html',
  styleUrl: './filtros.component.scss'
})
export class FiltrosComponent implements OnInit {
  @Output() filtrosChanged = new EventEmitter<FiltrosActivos>();

  carburante: FiltrosActivos['carburante'] = 'gasolina95';
  radioKm = 10;
  marcasBlanqueadas: string[] = [];

  marcasDisponibles = [
    'REPSOL', 'CEPSA', 'BP', 'SHELL', 'GALP', 'CAMPSA', 'PETRONOR',
    'ESSO', 'BALLENOIL', 'PLENOIL', 'CARREFOUR'
  ];

  tiposCarburante: { valor: FiltrosActivos['carburante']; etiqueta: string }[] = [
    { valor: 'gasolina95',    etiqueta: 'Gasolina 95' },
    { valor: 'gasoil',        etiqueta: 'Gasoil A' },
    { valor: 'gasolina98',    etiqueta: 'Gasolina 98' },
    { valor: 'gasoilPremium', etiqueta: 'Gasoil Premium' },
  ];

  ngOnInit() { this.emitir(); }

  toggleMarca(marca: string) {
    const idx = this.marcasBlanqueadas.indexOf(marca);
    if (idx === -1) this.marcasBlanqueadas.push(marca);
    else this.marcasBlanqueadas.splice(idx, 1);
    this.emitir();
  }

  estaSeleccionada(marca: string): boolean {
    return this.marcasBlanqueadas.includes(marca);
  }

  emitir() {
    this.filtrosChanged.emit({
      carburante: this.carburante,
      radioKm: this.radioKm,
      marcas: this.marcasBlanqueadas,
    });
  }
}