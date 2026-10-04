import { type NextRequest, NextResponse } from 'next/server';

const ACCESS = 'access_token';
const REFRESH = 'refresh_token';
const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const PROTECTED = ['/account', '/orders', '/checkout', '/admin'];

/** Reads the JWT payload without verifying it - only for UX decisions; the API verifies everything. */
function readAccess(token: string | undefined): { exp: number; role: string } | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(
      part
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(part.length / 4) * 4, '='),
    );
    const payload = JSON.parse(json) as { exp?: unknown; role?: unknown };
    if (typeof payload.exp !== 'number') return null;
    return { exp: payload.exp, role: typeof payload.role === 'string' ? payload.role : 'USER' };
  } catch {
    return null;
  }
}

function parseSetCookie(header: string): { name: string; value: string } | null {
  const [pair] = header.split(';');
  const index = pair?.indexOf('=') ?? -1;
  if (!pair || index <= 0) return null;
  return { name: pair.slice(0, index).trim(), value: pair.slice(index + 1).trim() };
}

/**
 * Next.js 16 proxy (formerly middleware):
 * 1. Silently refreshes an expired/expiring access token before rendering, so
 *    Server Components always see a valid session (and rotated cookies reach the browser).
 * 2. Redirects anonymous visitors away from private pages (the API enforces access anyway).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const setCookies: string[] = [];
  let clearSession = false;

  const payload = readAccess(access);
  const expiresSoon = !payload || payload.exp * 1000 - Date.now() < 60_000;

  if (refresh && expiresSoon) {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          cookie: `${REFRESH}=${refresh}`,
          'user-agent': request.headers.get('user-agent') ?? '',
          'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
        },
      });
      if (res.ok) {
        for (const header of res.headers.getSetCookie()) {
          setCookies.push(header);
          const cookie = parseSetCookie(header);
          if (cookie) request.cookies.set(cookie.name, cookie.value);
        }
        access = request.cookies.get(ACCESS)?.value;
      } else if (res.status === 401 || res.status === 403) {
        clearSession = true;
        access = undefined;
        request.cookies.delete(ACCESS);
        request.cookies.delete(REFRESH);
      }
    } catch {
      // API unreachable: render anyway, pages handle their own errors
    }
  }

  const authenticated = Boolean(access) && !clearSession;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let response: NextResponse;
  if (isProtected && !authenticated) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(login);
  } else if (pathname.startsWith('/admin') && readAccess(access)?.role !== 'ADMIN') {
    response = NextResponse.redirect(new URL('/', request.url));
  } else {
    // forward the refreshed cookies to Server Components of this very request
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  for (const header of setCookies) response.headers.append('set-cookie', header);
  if (clearSession) {
    response.cookies.delete(ACCESS);
    response.cookies.delete(REFRESH);
  }
  if (isProtected) response.headers.set('X-Robots-Tag', 'noindex');
  return response;
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|txt|xml)$).*)',
  ],
};
