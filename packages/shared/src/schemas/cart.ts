import { z } from 'zod';
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from '../cart';
import { FULFILLMENT_TYPES } from '../order-status';
import { idSchema, V } from './common';

export const cartItemSchema = z.strictObject({
  productId: idSchema,
  sizeId: idSchema.nullable(),
  crustId: idSchema.nullable(),
  removedIngredientIds: z.array(idSchema).max(30).default([]),
  extraIngredientIds: z.array(idSchema).max(30).default([]),
  quantity: z.number().int(V.invalid).min(1, V.invalid).max(MAX_ITEM_QUANTITY, V.invalid),
});
export type CartItemSchemaInput = z.input<typeof cartItemSchema>;

export const cartItemsSchema = z.array(cartItemSchema).max(MAX_CART_LINES);

export const replaceCartSchema = z.strictObject({ items: cartItemsSchema });
export type ReplaceCartInput = z.input<typeof replaceCartSchema>;

export const promoCodeValueSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, V.promoCode)
  .max(32, V.promoCode)
  .regex(/^[A-Z0-9_-]+$/, V.promoCode);

export const quoteCartSchema = z.strictObject({
  items: cartItemsSchema,
  promoCode: promoCodeValueSchema.optional(),
  fulfillment: z.enum(FULFILLMENT_TYPES).default('DELIVERY'),
});
export type QuoteCartInput = z.input<typeof quoteCartSchema>;
