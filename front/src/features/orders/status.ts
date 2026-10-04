import type { OrderStatus, PaymentStatus } from '@market/shared';
import type { BadgeTone } from '@/components/ui/controls';

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PREPARING: 'primary',
  READY: 'accent',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  CREATED: 'neutral',
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'info',
};
