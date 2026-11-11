import type { Issue } from '../shared/contracts';

export class ApiError extends Error {
  constructor(message: string, readonly issues: Issue[] = [], readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const form = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      headers: body && !form ? { 'Content-Type': 'application/json' } : undefined,
      body: form ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor local. Tente novamente.');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    const error = payload?.error;
    throw new ApiError(
      typeof error?.message === 'string' ? error.message : 'O servidor não concluiu a solicitação.',
      Array.isArray(error?.issues) ? error.issues : [],
      response.status,
    );
  }
  return payload as T;
}

export function messageFrom(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(error instanceof Error ? error.message : 'Ocorreu um erro inesperado.');
}

export function operationFile(id: string): string {
  return '/api/operations/' + encodeURIComponent(id) + '.xlsx';
}

export function catalogFile(folder: 'templates' | 'fixtures', kind: string, extension: 'csv' | 'xlsx'): string {
  return '/api/' + folder + '/' + kind + '.' + extension;
}
