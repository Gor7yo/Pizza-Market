import { z } from 'zod';
import { LOCALES } from '../locale';
import { CURRENCIES } from '../money';
import { nameSchema, phoneSchema, V } from './common';

export const updateProfileSchema = z.strictObject({
  firstName: nameSchema,
  lastName: z.string().trim().max(60, V.tooLong).nullable().optional(),
  /** '' clears the phone */
  phone: z
    .union([z.literal(''), phoneSchema])
    .nullable()
    .optional(),
  locale: z.enum(LOCALES).optional(),
  preferredCurrency: z.enum(CURRENCIES).optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const addressSchema = z.strictObject({
  label: z.string().trim().max(40, V.tooLong).optional(),
  country: z.string().trim().length(2, V.invalid).toUpperCase().default('AM'),
  city: z.string({ error: V.required }).trim().min(1, V.required).max(80, V.tooLong),
  street: z.string({ error: V.required }).trim().min(1, V.required).max(160, V.tooLong),
  apartment: z.string().trim().max(20, V.tooLong).optional(),
  entrance: z.string().trim().max(20, V.tooLong).optional(),
  floor: z.string().trim().max(20, V.tooLong).optional(),
  intercom: z.string().trim().max(20, V.tooLong).optional(),
  instructions: z.string().trim().max(500, V.tooLong).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;
