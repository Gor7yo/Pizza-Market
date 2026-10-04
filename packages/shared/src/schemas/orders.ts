import { z } from 'zod';
import { FULFILLMENT_TYPES, ORDER_STATUSES, PAYMENT_METHODS } from '../order-status';
import { cartItemsSchema, promoCodeValueSchema } from './cart';
import {
  idSchema,
  isoDateTimeSchema,
  nameSchema,
  paginationQuerySchema,
  phoneSchema,
  V,
} from './common';
import { addressSchema } from './profile';

export const createOrderSchema = z
  .strictObject({
    items: cartItemsSchema.min(1, V.required),
    fulfillment: z.enum(FULFILLMENT_TYPES),
    addressId: idSchema.optional(),
    address: addressSchema.optional(),
    saveAddress: z.boolean().default(false),
    contactName: nameSchema,
    contactPhone: phoneSchema,
    comment: z.string().trim().max(500, V.tooLong).optional(),
    promoCode: promoCodeValueSchema.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS),
  })
  .refine((o) => o.fulfillment === 'PICKUP' || Boolean(o.addressId) !== Boolean(o.address), {
    error: V.required,
    path: ['address'],
  });
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const orderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
});
export type OrderListQuery = z.input<typeof orderListQuerySchema>;

export const adminOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type AdminOrderListQuery = z.input<typeof adminOrderListQuerySchema>;

export const updateOrderStatusSchema = z.strictObject({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500, V.tooLong).optional(),
});
export type UpdateOrderStatusInput = z.input<typeof updateOrderStatusSchema>;

export const mockPaymentConfirmSchema = z.strictObject({
  outcome: z.enum(['success', 'failure']),
});
export type MockPaymentConfirmInput = z.input<typeof mockPaymentConfirmSchema>;
