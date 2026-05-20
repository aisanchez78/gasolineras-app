import { ErrorHandler, inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorService } from '../services/error.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private errorSvc = inject(ErrorService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
    if (!(error instanceof HttpErrorResponse)) {
      this.errorSvc.error('Se ha producido un error inesperado en la aplicación.');
    }
  }
}
