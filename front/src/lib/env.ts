import { isLocale, type Locale } from '@market/shared';

/** Public configuration (inlined at build time). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE;
export const DEFAULT_LOCALE: Locale = isLocale(defaultLocale) ? defaultLocale : 'ru';

export const MAP_PROVIDER = process.env.NEXT_PUBLIC_MAP_PROVIDER ?? 'osm';

export const BRAND_NAME = 'Tonir Pizza';
