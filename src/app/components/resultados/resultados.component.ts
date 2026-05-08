import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
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
export class ResultadosComponent implements OnChanges {
  constructor(private cdr: ChangeDetectorRef) {}
  @Input() stations: Gasolinera[] = [];
  @Input() filters!: ActiveFilters;
  @Input() order: SortOrder = 'price';
  @Input() loading = false;
  @Input() hasSearched = false;
  @Input() comparisonSelection: Gasolinera[] = [];
  @Output() orderChanged = new EventEmitter<SortOrder>();
  @Output() toggleComparison = new EventEmitter<Gasolinera>();
  @Output() routeSelected = new EventEmitter<Gasolinera>();

  readonly PAGE_SIZE = 6;
  currentPage = 1;

  opciones: { value: SortOrder; label: string; icon: string }[] = [
    { value: 'price',    label: 'Precio',    icon: '💰' },
    { value: 'distance', label: 'Distancia', icon: '📍' },
    { value: 'name',     label: 'Nombre',    icon: '🔤' },
  ];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['stations'] || changes['order']) {
      this.currentPage = 1;
    }
  }

  get totalPages(): number {
    return Math.ceil(this.stations.length / this.PAGE_SIZE);
  }

  get pagedStations(): Gasolinera[] {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    return this.stations.slice(start, start + this.PAGE_SIZE);
  }

  get pageNumbers(): (number | '...')[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (this.currentPage > 3) pages.push('...');
    const start = Math.max(2, this.currentPage - 1);
    const end   = Math.min(total - 1, this.currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (this.currentPage < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  goToPage(page: number | '...') {
    if (page === '...' || page < 1 || page > this.totalPages) return;
    const dir = (page as number) > this.currentPage ? 'forward' : 'back';
    document.documentElement.dataset['pgDir'] = dir;

    const update = () => {
      this.currentPage = page as number;
      this.cdr.detectChanges();
    };

    if ('startViewTransition' in document) {
      (document as any).startViewTransition(update);
    } else {
      update();
    }

    document.querySelector('.resultados-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  isSelected(g: Gasolinera): boolean {
    return this.comparisonSelection.some(s => s.id === g.id);
  }

  get isComparisonFull(): boolean {
    return this.comparisonSelection.length >= 3;
  }
}
