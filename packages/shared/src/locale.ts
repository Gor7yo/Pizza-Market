export const LOCALES = ['ru', 'en', 'hy'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  hy: 'Հայերեն',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Catalog content (product names, descriptions...) is stored per locale.
 * Only one locale is required; missing translations fall back.
 */
export type LocalizedText = Partial<Record<Locale, string>>;

export function localize(
  text: LocalizedText | null | undefined,
  locale: Locale,
  fallback: Locale = 'ru',
): string {
  if (!text) return '';
  const direct = text[locale]?.trim();
  if (direct) return direct;
  const fb = text[fallback]?.trim();
  if (fb) return fb;
  for (const l of LOCALES) {
    const value = text[l]?.trim();
    if (value) return value;
  }
  return '';
}

/** Lower-cased concatenation of every translation, used for DB search. */
export function buildSearchText(...texts: (LocalizedText | null | undefined)[]): string {
  return texts
    .flatMap((t) => (t ? Object.values(t) : []))
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ')
    .toLowerCase();
}
