'use client';

import { type Locale, localize, type LocalizedText } from '@market/shared';
import { useLocale } from 'next-intl';
import { DEFAULT_LOCALE } from './env';

/** Picks the visitor's translation of catalog content (with fallback). */
export function useLocalize() {
  const locale = useLocale() as Locale;
  return (text: LocalizedText | null | undefined) => localize(text, locale, DEFAULT_LOCALE);
}
