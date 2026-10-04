import type { Currency, PaymentStatus } from '@market/shared';

export interface CreatePaymentInput {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  amount: number;
  currency: Currency;
}

export interface CreatePaymentResult {
  providerPaymentId: string;
  status: PaymentStatus;
  /** Where the customer completes the payment (hosted page / 3-D Secure) */
  redirectUrl: string | null;
}

/**
 * Online payment provider contract. The order system depends on this class only.
 * A real implementation (an Armenian acquiring bank, Stripe...) must confirm payments
 * through server-to-server callbacks verified with the provider's signature —
 * never because the browser says so.
 */
export abstract class PaymentProvider {
  abstract readonly name: string;
  abstract createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  abstract refund(providerPaymentId: string, amount: number): Promise<{ status: PaymentStatus }>;
}
