import type { Gallery, Health, Meta, Result } from './types';

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '';
export const MOCK = import.meta.env.VITE_MOCK === '1';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Turn an API error into the sentence we show the user. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'The daily demo limit has been reached. Try again tomorrow, or open one of the examples.';
    if (err.status === 404) return 'That result no longer exists. It may have expired.';
    if (err.status === 413) return err.message || 'That image is too large. Try a smaller file.';
    return err.message;
  }
  if (err instanceof TypeError) return 'Could not reach the inspection service. Check your connection and try again.';
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** Image URLs are relative (/api/files/...) locally or absolute (presigned S3) on AWS. */
export function assetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${API_BASE}${url}`;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (MOCK) {
    const { mockRequest } = await import('./mock');
    return mockRequest<T>(method, path, body);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`.trim();
    try {
      const json = (await res.json()) as { detail?: unknown };
      if (typeof json.detail === 'string') detail = json.detail;
      else if (json.detail) detail = JSON.stringify(json.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  meta: () => request<Meta>('GET', '/api/meta'),
  health: () => request<Health>('GET', '/api/health'),
  analyze: (image_base64: string, filename: string) =>
    request<Result>('POST', '/api/analyze', { image_base64, filename }),
  analyzeUrl: (url: string) => request<Result>('POST', '/api/analyze-url', { url }),
  fix: (id: string) => request<{ id: string; state: 'running' }>('POST', `/api/fix/${encodeURIComponent(id)}`, {}),
  result: (id: string) => request<Result>('GET', `/api/results/${encodeURIComponent(id)}`),
  gallery: () => request<Gallery>('GET', '/api/gallery'),
};
