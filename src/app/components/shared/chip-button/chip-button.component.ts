import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chip-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="chip-btn"
      [class.chip-btn--active]="active"
      [attr.aria-pressed]="active"
      [disabled]="disabled"
      (click)="clicked.emit()">
      <ng-content />
    </button>
  `,
  styles: [`
    .chip-btn {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      font-family: var(--font-body);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .chip-btn:hover:not(:disabled) {
      border-color: var(--accent);
      color: var(--accent);
    }
    .chip-btn--active {
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    .chip-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `],
})
export class ChipButtonComponent {
  @Input() active = false;
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<void>();
}
