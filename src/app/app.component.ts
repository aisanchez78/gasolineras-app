import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuscadorComponent } from './components/buscador/buscador.component';
import { FiltrosComponent } from './components/filtros/filtros.component';
import { ResultadosComponent } from './components/resultados/resultados.component';
import { MapaComponent } from './components/mapa/mapa.component';
import { GasolineraService } from './services/gasolinera.service';
import { Gasolinera, FiltrosActivos, Coordenadas, OrdenResultados } from './models/gasolinera.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BuscadorComponent, FiltrosComponent, ResultadosComponent, MapaComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private svc = inject(GasolineraService);
  private cdr = inject(ChangeDetectorRef);

  posicion: Coordenadas | null = null;
  filtros: FiltrosActivos = { carburante: 'gasolina95', radioKm: 10, marcas: [] };
  orden: OrdenResultados = 'precio';
  todasGasolineras: Gasolinera[] = [];
  // Resultado post-OSRM, pre-orden. Se guarda para re-ordenar sin volver a llamar a OSRM.
  candidatosEnriquecidos: Gasolinera[] = [];
  gasolinerasFiltradas: Gasolinera[] = [];
  cargando = false;
  busquedaRealizada = false;

  onPosicion(pos: Coordenadas) { this.posicion = pos; this.buscar(); }

  onFiltros(f: FiltrosActivos) {
    this.filtros = f;
    if (this.posicion) this.aplicarFiltros();
  }

  onOrden(o: OrdenResultados) {
    this.orden = o;
    // Solo re-ordena los candidatos ya enriquecidos, sin llamar a OSRM de nuevo
    if (this.candidatosEnriquecidos.length > 0) {
      this.gasolinerasFiltradas = this.svc.ordenarYLimitar(this.candidatosEnriquecidos, this.orden, this.filtros.carburante);
      this.cdr.detectChanges();
    }
  }

  private buscar() {
    if (!this.posicion) return;
    this.cargando = true;
    this.cdr.detectChanges();

    if (this.todasGasolineras.length > 0) {
      this.aplicarFiltros();
      return;
    }

    this.svc.obtenerTodasEstaciones().subscribe({
      next: data => { this.todasGasolineras = data; this.aplicarFiltros(); },
      error: () => { this.cargando = false; this.busquedaRealizada = true; this.cdr.detectChanges(); }
    });
  }

  private aplicarFiltros() {
    if (!this.posicion) return;

    const candidatos = this.svc.filtrarCandidatos(this.todasGasolineras, this.posicion, this.filtros);

    this.svc.enriquecerConDistanciasReales(candidatos, this.posicion).subscribe({
      next: enriquecidos => {
        this.candidatosEnriquecidos  = enriquecidos;
        this.gasolinerasFiltradas    = this.svc.ordenarYLimitar(enriquecidos, this.orden, this.filtros.carburante);
        this.cargando                = false;
        this.busquedaRealizada       = true;
        this.cdr.detectChanges();
      },
      error: () => { this.cargando = false; this.busquedaRealizada = true; this.cdr.detectChanges(); }
    });
  }
}
