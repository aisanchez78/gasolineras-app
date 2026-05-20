import { Injectable, signal } from '@angular/core';

export interface ErrorNotification {
  message: string;
  type: 'error' | 'warning';
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorService {
  readonly current = signal<ErrorNotification | null>(null);

  private nextId = 0;

  error(message: string): void {
    this.current.set({ message, type: 'error', id: this.nextId++ });
  }

  warn(message: string): void {
    this.current.set({ message, type: 'warning', id: this.nextId++ });
  }

  clear(): void {
    this.current.set(null);
  }
}
