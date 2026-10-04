import { z } from 'zod';
import { PROMO_TYPES } from '../pricing';
import { promoCodeValueSchema } from './cart';
import { idSchema, isoDateTimeSchema, moneySchema, paginationQuerySchema, V } from './common';

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const promoCodeInputSchema = z
  .strictObject({
    code: promoCodeValueSchema,
    description: z.string().trim().max(200, V.tooLong).optional(),
    type: z.enum(PROMO_TYPES),
    value: z.number().int(V.invalid).min(1, V.positive),
    maxDiscount: moneySchema.nullable().default(null),
    minOrderAmount: moneySchema.default(0),
    startsAt: isoDateTimeSchema.nullable().default(null),
    expiresAt: isoDateTimeSchema.nullable().default(null),
    usageLimit: z.number().int().min(1).nullable().default(null),
    perUserLimit: z.number().int().min(1).nullable().default(null),
    isActive: z.boolean().default(true),
    productIds: z.array(idSchema).max(200).default([]),
    categoryIds: z.array(idSchema).max(50).default([]),
  })
  .refine((p) => p.type !== 'PERCENT' || p.value <= 100, {
    error: V.percentRange,
    path: ['value'],
  })
  .refine((p) => !p.startsAt || !p.expiresAt || new Date(p.startsAt) < new Date(p.expiresAt), {
    error: V.dateRange,
    path: ['expiresAt'],
  });
export type PromoCodeInput = z.input<typeof promoCodeInputSchema>;
export type PromoCodeData = z.output<typeof promoCodeInputSchema>;

export const adminPromoListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(50).optional(),
});

export const adminUserListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
});
export type AdminUserListQuery = z.input<typeof adminUserListQuerySchema>;

export const adminUpdateUserSchema = z
  .strictObject({
    role: z.enum(USER_ROLES).optional(),
    isBlocked: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isBlocked !== undefined, { error: V.required });
export type AdminUpdateUserInput = z.input<typeof adminUpdateUserSchema>;

export const createReviewSchema = z.strictObject({
  productId: idSchema,
  rating: z.number().int().min(1, V.invalid).max(5, V.invalid),
  comment: z.string().trim().max(2000, V.tooLong).optional(),
});
export type CreateReviewInput = z.input<typeof createReviewSchema>;

export const moderateReviewSchema = z.strictObject({
  status: z.enum(['APPROVED', 'REJECTED']),
});
export type ModerateReviewInput = z.input<typeof moderateReviewSchema>;

export const adminReviewListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REVIEW_STATUSES).optional(),
});

export const auditLogQuerySchema = paginationQuerySchema.extend({
  entityType: z.string().trim().max(50).optional(),
  action: z.string().trim().max(80).optional(),
  actorId: idSchema.optional(),
});
export type AuditLogQuery = z.input<typeof auditLogQuerySchema>;

const rateSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,10})?$/, V.invalid)
  .nullable();

export const storeSettingsSchema = z.strictObject({
  isAcceptingOrders: z.boolean(),
  deliveryFee: moneySchema,
  freeDeliveryThreshold: moneySchema.nullable(),
  minOrderAmount: moneySchema,
  pickupAddress: z.string().trim().max(200, V.tooLong),
  supportPhone: z.string().trim().max(30, V.tooLong),
  /** Units of each currency per 1 unit of the store currency; null = not shown */
  exchangeRates: z.strictObject({
    AMD: rateSchema.optional(),
    USD: rateSchema.optional(),
    RUB: rateSchema.optional(),
  }),
});
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
export type StoreSettingsData = z.output<typeof storeSettingsSchema>;

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
