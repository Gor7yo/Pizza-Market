import type { OrderStatus } from '@market/shared';

/** Domain events: orders publish, notifications (and future integrations) subscribe. */
export const ORDER_EVENTS = {
  created: 'order.created',
  statusChanged: 'order.status_changed',
} as const;

export interface OrderCreatedEvent {
  orderId: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
}
