import { ApiError } from './errors';

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Do not try to refresh the session on 401 (auth endpoints themselves). */
  skipRefresh?: boolean;
}

export const SESSION_EXPIRED_EVENT = 'market:session-expired';

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s wait for one refresh call. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok && typeof window !== 'undefined')
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return res.ok;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * Browser API client. Same-origin requests (proxied by Next.js rewrites) with
 * HttpOnly cookies; tokens are never visible to JavaScript.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers, signal, skipRefresh } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const send = () =>
    fetch(`/api/v1${path}${buildQuery(query)}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 401 && !skipRefresh && (await refreshSession())) {
    res = await send();
  }
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
