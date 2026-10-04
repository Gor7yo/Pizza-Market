import { Injectable } from '@nestjs/common';
import type { PaymentStatus } from '@market/shared';
import { randomToken } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config.service';
import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  PaymentProvider,
} from './payment-provider';

/**
 * Development/demo provider. It behaves like a hosted payment page:
 * the payment starts PENDING, the customer is redirected to /checkout/pay/:orderId,
 * and the outcome is reported back through `simulate()` which plays the role of
 * the provider's server-side callback. No real money moves.
 */
@Injectable()
export class MockPaymentProvider extends PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly config: AppConfig) {
    super();
  }

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return Promise.resolve({
      providerPaymentId: `mock_${randomToken(12)}`,
      status: 'PENDING',
      redirectUrl: `${this.config.get('PUBLIC_WEB_URL')}/checkout/pay/${input.orderId}`,
    });
  }

  refund(_providerPaymentId: string, _amount: number): Promise<{ status: PaymentStatus }> {
    return Promise.resolve({ status: 'REFUNDED' });
  }

  simulate(outcome: 'success' | 'failure'): {
    status: PaymentStatus;
    failureReason: string | null;
  } {
    return outcome === 'success'
      ? { status: 'SUCCEEDED', failureReason: null }
      : { status: 'FAILED', failureReason: 'Card declined (mock)' };
  }
}
