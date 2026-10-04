export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_TYPES = ['DELIVERY', 'PICKUP'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const PAYMENT_METHODS = ['CARD', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'CREATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const BASE_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * READY branches by fulfillment: deliveries go out with a courier,
 * pickups are handed over directly (DELIVERED = picked up).
 */
export function getAllowedTransitions(
  status: OrderStatus,
  fulfillment: FulfillmentType,
): OrderStatus[] {
  return BASE_TRANSITIONS[status].filter((next) => {
    if (status !== 'READY') return true;
    if (fulfillment === 'DELIVERY') return next !== 'DELIVERED';
    return next !== 'OUT_FOR_DELIVERY';
  });
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: FulfillmentType,
): boolean {
  return getAllowedTransitions(from, fulfillment).includes(to);
}

/** Customers may cancel only before the kitchen accepted the order. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['PENDING'];

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
];

export function isFinalStatus(status: OrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED';
}

export function getTrackingSteps(fulfillment: FulfillmentType): OrderStatus[] {
  return fulfillment === 'DELIVERY'
    ? ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
    : ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
}
