import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge"
      [class.status-badge--open]="open"
      [class.status-badge--closed]="!open">
      ● {{ open ? 'Abierta' : 'Cerrada' }}
    </span>
  `,
  styles: [`
    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .status-badge--open  { color: var(--status-open,  #22c55e); }
    .status-badge--closed { color: var(--status-closed, #ef4444); }
  `],
})
export class StatusBadgeComponent {
  @Input() open = false;
}
