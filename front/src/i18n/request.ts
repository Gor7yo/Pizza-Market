import { isLocale, type Locale, LOCALES } from '@market/shared';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE } from '@/lib/env';
import { LOCALE_COOKIE } from './constants';

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object'
        ? deepMerge(current as Messages, value as Messages)
        : value;
  }
  return out;
}

function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const code = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
    if (code && (LOCALES as readonly string[]).includes(code)) return code as Locale;
  }
  return null;
}

async function loadMessages(locale: Locale): Promise<Messages> {
  return ((await import(`../../messages/${locale}.json`)) as { default: Messages }).default;
}

/**
 * Locale = cookie (explicit choice) > Accept-Language > NEXT_PUBLIC_DEFAULT_LOCALE.
 * English is the complete fallback, so a partially translated locale never shows raw keys.
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale)
    ? cookieLocale
    : (fromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE);

  const fallback = await loadMessages('en');
  const messages = locale === 'en' ? fallback : deepMerge(fallback, await loadMessages(locale));

  return { locale, messages, timeZone: 'Asia/Yerevan' };
});
