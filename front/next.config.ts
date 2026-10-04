import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** Where the Next.js server reaches the API (never exposed to the browser). */
const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const isDev = process.env.NODE_ENV !== 'production';

/** Extra image hosts (e.g. a production CDN): comma-separated hostnames. */
const extraImageHosts = (process.env.IMAGE_REMOTE_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:8333",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // The persistent Turbopack dev cache restored stale route trees on Windows
    // (route groups like (auth)/(store) intermittently resolved to 404).
    turbopackFileSystemCacheForDev: false,
  },
  output: 'standalone',
  // monorepo root, so standalone output includes workspace packages
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // CC0 photos of Armenian dishes (gata, tan)
      { protocol: 'https', hostname: 'thumb.wikimedia.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      // local S3 (SeaweedFS from docker-compose)
      { protocol: 'http', hostname: 'localhost', port: '8333' },
      ...extraImageHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    ],
  },
  // The browser talks only to its own origin: auth cookies stay first-party,
  // CORS is not needed and the API URL is not exposed.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
