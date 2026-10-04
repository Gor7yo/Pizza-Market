import {
  CUSTOMER_CANCELLABLE_STATUSES,
  type LocalizedText,
  type OrderAddressDto,
  type OrderDetailDto,
  type OrderItemDto,
  type OrderSummaryDto,
  type PaymentDto,
  type ServerCartItemDto,
} from '@market/shared';
import { asLocalized, asLocalizedOrNull, jsonAs } from '../../common/utils/json';
import type {
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  Prisma,
} from '../../generated/prisma/client';
import type { FileStorage } from '../../infrastructure/storage/file-storage';

export const orderDetailInclude = {
  items: true,
  history: { orderBy: { createdAt: 'asc' } },
  payment: true,
} satisfies Prisma.OrderInclude;

export type OrderWithDetails = Order & {
  items: OrderItem[];
  history: OrderStatusHistory[];
  payment: Payment | null;
};

export function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    provider: p.provider,
    method: p.method,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    redirectUrl: p.status === 'PENDING' ? p.redirectUrl : null,
    failureReason: p.failureReason,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toOrderSummary(
  o: Order & { items: Pick<OrderItem, 'quantity'>[]; payment: Pick<Payment, 'status'> | null },
): OrderSummaryDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    fulfillment: o.fulfillment,
    total: o.total,
    currency: o.currency,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    paymentStatus: o.payment?.status ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toOrderItemDto(i: OrderItem, storage: FileStorage): OrderItemDto {
  return {
    id: i.id,
    productId: i.productId,
    productSlug: i.productSlug,
    name: asLocalized(i.name),
    imageUrl: storage.urlOrNull(i.imageKey),
    sizeCm: i.sizeCm,
    crustName: asLocalizedOrNull(i.crustName),
    removedIngredients: jsonAs<{ id: string; name: LocalizedText }[]>(i.removedIngredients, []),
    extraIngredients: jsonAs<{ id: string; name: LocalizedText; price: number }[]>(
      i.extraIngredients,
      [],
    ),
    configuration: jsonAs<ServerCartItemDto>(i.configuration, {
      productId: i.productId ?? '',
      sizeId: i.sizeId,
      crustId: i.crustId,
      removedIngredientIds: [],
      extraIngredientIds: [],
      quantity: i.quantity,
    }),
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: i.lineTotal,
  };
}

export function toOrderDetail(
  o: OrderWithDetails,
  storage: FileStorage,
  reviewableProductIds: string[] = [],
): OrderDetailDto {
  return {
    ...toOrderSummary(o),
    subtotal: o.subtotal,
    discount: o.discount,
    deliveryFee: o.deliveryFee,
    promoCode: o.promoCodeText,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    comment: o.comment,
    address: jsonAs<OrderAddressDto | null>(o.address, null),
    items: o.items.map((i) => toOrderItemDto(i, storage)),
    history: o.history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    payment: o.payment ? toPaymentDto(o.payment) : null,
    canCancel: CUSTOMER_CANCELLABLE_STATUSES.includes(o.status),
    reviewableProductIds,
  };
}
