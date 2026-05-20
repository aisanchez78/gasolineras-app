export interface ProviderError extends Error {
  provider: string;
  statusCode?: number;
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof Error && 'provider' in e;
}

export function makeProviderError(message: string, provider: string, statusCode?: number): ProviderError {
  const err = new Error(message) as ProviderError;
  err.provider = provider;
  err.statusCode = statusCode;
  return err;
}
