import type { Currency, Locale, OrderStatus } from '@market/shared';

export interface NotificationRecipient {
  userId: string;
  email: string;
  firstName: string;
  locale: Locale;
  phone: string | null;
}

export type Notification =
  | {
      type: 'order.created';
      orderId: string;
      orderNumber: number;
      total: number;
      currency: Currency;
      items: { name: string; quantity: number }[];
    }
  | { type: 'order.status'; orderId: string; orderNumber: number; status: OrderStatus };

/**
 * A delivery channel (e-mail today; push/SMS later). Adding a channel means
 * implementing this class and registering it in NotificationsModule.
 */
export abstract class NotificationChannel {
  abstract readonly name: string;
  abstract send(recipient: NotificationRecipient, notification: Notification): Promise<void>;
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
