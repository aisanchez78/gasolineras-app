import { Component, inject, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorService } from '../../../services/error.service';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error-toast.component.html',
  styleUrl: './error-toast.component.scss',
})
export class ErrorToastComponent implements OnDestroy {
  readonly errorSvc = inject(ErrorService);

  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const notification = this.errorSvc.current();
      if (this.dismissTimer) {
        clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
      }
      if (notification?.type === 'warning') {
        this.dismissTimer = setTimeout(() => this.errorSvc.clear(), 5000);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
  }

  dismiss(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.errorSvc.clear();
  }
}
