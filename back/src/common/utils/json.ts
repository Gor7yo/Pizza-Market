import type { LocalizedText } from '@market/shared';
import type { Prisma } from '../../generated/prisma/client';

/** Narrows a Prisma Json column holding localized text. */
export function asLocalized(value: Prisma.JsonValue | null | undefined): LocalizedText {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const result: LocalizedText = {};
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'ru' || k === 'en' || k === 'hy') && typeof v === 'string') result[k] = v;
    }
    return result;
  }
  return {};
}

export function asLocalizedOrNull(
  value: Prisma.JsonValue | null | undefined,
): LocalizedText | null {
  return value === null || value === undefined ? null : asLocalized(value);
}

/** Removes empty translations before persisting. */
export function cleanLocalized(text: LocalizedText | undefined): Prisma.InputJsonObject {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(text ?? {})) {
    if (typeof v === 'string' && v.trim()) result[k] = v.trim();
  }
  return result;
}

/** Typed reader for Json columns that store arrays/objects we wrote ourselves. */
export function jsonAs<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  return (value ?? fallback) as T;
}
