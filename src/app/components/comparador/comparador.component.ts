import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Gasolinera, FiltrosActivos } from '../../models/gasolinera.model';

type CampoPrecio = 'Precio Gasolina 95 E5' | 'Precio Gasoleo A' | 'Precio Gasolina 98 E5' | 'Precio Gasoil Premium';

const FILAS: { label: string; campo: CampoPrecio }[] = [
  { label: 'G95',       campo: 'Precio Gasolina 95 E5' },
  { label: 'Gasóleo A', campo: 'Precio Gasoleo A' },
  { label: 'G98',       campo: 'Precio Gasolina 98 E5' },
  { label: 'Gasoil P.', campo: 'Precio Gasoil Premium' },
];

@Component({
  selector: 'app-comparador',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparador.component.html',
  styleUrl: './comparador.component.scss',
})
export class ComparadorComponent implements OnChanges {
  @Input() seleccionadas: Gasolinera[] = [];
  @Input() filtros!: FiltrosActivos;
  @Output() remover = new EventEmitter<Gasolinera>();
  @Output() limpiar = new EventEmitter<void>();

  panelAbierto = false;
  readonly filas = FILAS;

  ngOnChanges() {
    if (this.seleccionadas.length === 0) this.panelAbierto = false;
  }

  togglePanel() { this.panelAbierto = !this.panelAbierto; }

  precio(g: Gasolinera, campo: CampoPrecio): string {
    return (g[campo] as string)?.trim() || '—';
  }

  private parsear(s: string): number {
    if (!s || s.trim() === '' || s === '—') return Infinity;
    return parseFloat(s.replace(',', '.'));
  }

  esMejorPrecio(g: Gasolinera, campo: CampoPrecio): boolean {
    const val = this.parsear(g[campo] as string);
    if (val === Infinity) return false;
    const min = Math.min(...this.seleccionadas.map(s => this.parsear(s[campo] as string)));
    return val === min;
  }

  esMejorDistancia(g: Gasolinera): boolean {
    const min = Math.min(...this.seleccionadas.map(s => s.distancia ?? Infinity));
    return (g.distancia ?? Infinity) === min;
  }

  labelCarburante(): string {
    const map: Record<string, string> = {
      gasolina95: 'G95', gasoil: 'Gasóleo A', gasolina98: 'G98', gasoilPremium: 'Gasoil P.',
    };
    return map[this.filtros?.carburante] ?? '';
  }
}
