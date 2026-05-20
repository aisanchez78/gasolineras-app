import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { makeProviderError } from '../models/app-error.model';

const PROVIDER_MAP: { pattern: string; name: string }[] = [
  { pattern: 'minetur',    name: 'MINETUR (Ministerio de Energía)' },
  { pattern: 'osrm',       name: 'OSRM (cálculo de rutas)' },
  { pattern: 'nominatim',  name: 'Nominatim (geocodificación)' },
  { pattern: 'ipapi',      name: 'servicio de geolocalización por IP' },
];

function resolveProvider(url: string): string | null {
  const lower = url.toLowerCase();
  return PROVIDER_MAP.find(p => lower.includes(p.pattern))?.name ?? null;
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const provider = resolveProvider(req.url);
        if (provider) {
          return throwError(() =>
            makeProviderError(err.message, provider, err.status)
          );
        }
      }
      return throwError(() => err);
    })
  );
