import { z } from 'zod';
import { LOCALES } from '../locale';

/**
 * Validation messages are translation keys (namespace `validation` in the web app),
 * so the same schema produces localized errors on the client and stable keys on the API.
 */
export const V = {
  required: 'required',
  email: 'email',
  passwordMin: 'passwordMin',
  passwordWeak: 'passwordWeak',
  passwordsMismatch: 'passwordsMismatch',
  phone: 'phone',
  tooLong: 'tooLong',
  tooShort: 'tooShort',
  codeFormat: 'codeFormat',
  invalid: 'invalid',
  slug: 'slug',
  promoCode: 'promoCode',
  percentRange: 'percentRange',
  positive: 'positive',
  dateRange: 'dateRange',
} as const;

export const idSchema = z.uuid({ error: V.invalid });

export const emailSchema = z
  .string({ error: V.required })
  .trim()
  .toLowerCase()
  .min(1, V.required)
  .max(254, V.tooLong)
  .pipe(z.email({ error: V.email }));

export const phoneSchema = z
  .string({ error: V.required })
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?[1-9]\d{7,14}$/, V.phone));

export const nameSchema = z
  .string({ error: V.required })
  .trim()
  .min(1, V.required)
  .max(60, V.tooLong);

export const slugSchema = z
  .string({ error: V.required })
  .trim()
  .toLowerCase()
  .min(2, V.tooShort)
  .max(80, V.tooLong)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, V.slug);

/** Integer minor units, up to 10 million major AMD - generous upper bound against typos. */
export const moneySchema = z
  .number({ error: V.required })
  .int(V.invalid)
  .min(0, V.positive)
  .max(1_000_000_000, V.tooLong);

export function localizedTextSchema(maxLength: number) {
  const field = z.string().trim().max(maxLength, V.tooLong).optional();
  return z
    .strictObject(
      Object.fromEntries(LOCALES.map((l) => [l, field])) as Record<
        (typeof LOCALES)[number],
        typeof field
      >,
    )
    .refine((t) => Object.values(t).some((v) => typeof v === 'string' && v.length > 0), {
      error: V.required,
    });
}

export function optionalLocalizedTextSchema(maxLength: number) {
  const field = z.string().trim().max(maxLength, V.tooLong).optional();
  return z.strictObject(
    Object.fromEntries(LOCALES.map((l) => [l, field])) as Record<
      (typeof LOCALES)[number],
      typeof field
    >,
  );
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** "a,b,c" or repeated params -> string[] */
export function csvArray<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }, z.array(item).max(20).optional());
}

export const isoDateTimeSchema = z.iso.datetime({ offset: true, error: V.invalid });
