'use client';

import { useTranslations } from 'next-intl';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api/errors';

/** Translates any thrown error into a user-friendly message (never raw server text). */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      const key = error.code;
      return t.has(key) ? t(key) : t('INTERNAL_ERROR');
    }
    if (error instanceof TypeError) return t('NETWORK');
    return t('INTERNAL_ERROR');
  };
}

/** Maps API field errors (`error.fields`) onto react-hook-form fields. Returns true if any matched. */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly string[],
): boolean {
  if (!(error instanceof ApiError) || !error.fields) return false;
  let matched = false;
  for (const [path, message] of Object.entries(error.fields)) {
    if (fieldNames.includes(path)) {
      setError(path as Path<T>, { type: 'server', message });
      matched = true;
    }
  }
  return matched;
}
