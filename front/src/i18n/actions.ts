'use server';

import { isLocale } from '@market/shared';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE } from './constants';

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
