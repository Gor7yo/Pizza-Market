import 'server-only';
import { cookies, headers } from 'next/headers';
import { ApiError } from './errors';

const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

interface ServerRequestOptions {
  /** Forward the visitor's cookies (personalized, never cached). */
  auth?: boolean;
  /** Seconds to cache public data (ISR-style data cache). */
  revalidate?: number;
  tags?: string[];
}

/**
 * Fetch from Server Components. Public data is cached by Next's data cache;
 * personalized requests forward cookies and bypass the cache.
 */
export async function serverApi<T>(path: string, options: ServerRequestOptions = {}): Promise<T> {
  const requestHeaders: Record<string, string> = { Accept: 'application/json' };
  if (options.auth) {
    requestHeaders.cookie = (await cookies()).toString();
    const forwarded = (await headers()).get('x-forwarded-for');
    if (forwarded) requestHeaders['x-forwarded-for'] = forwarded;
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: requestHeaders,
    ...(options.auth
      ? { cache: 'no-store' as const }
      : { next: { revalidate: options.revalidate ?? 60, tags: options.tags } }),
  });
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as T;
}

/** Returns null instead of throwing for 401/404 (optional data). */
export async function serverApiOptional<T>(
  path: string,
  options: ServerRequestOptions = {},
): Promise<T | null> {
  try {
    return await serverApi<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
    throw err;
  }
}
