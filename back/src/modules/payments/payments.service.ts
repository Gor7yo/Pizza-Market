import { Injectable, Logger } from '@nestjs/common';
import type { PaymentMethod, PaymentStatus } from '@market/shared';
import { AppException } from '../../common/errors/app.exception';
import type { Order, Payment, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider';

const OFFLINE_PROVIDER = 'offline';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PaymentProvider,
  ) {}

  /** Called inside the order transaction. Cash is collected on delivery/pickup. */
  async createForOrder(
    order: Order,
    method: PaymentMethod,
    tx: Prisma.TransactionClient,
  ): Promise<Payment> {
    if (method === 'CASH') {
      return tx.payment.create({
        data: {
          orderId: order.id,
          provider: OFFLINE_PROVIDER,
          method,
          status: 'PENDING',
          amount: order.total,
          currency: order.currency,
        },
      });
    }
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: this.provider.name,
        method,
        status: 'CREATED',
        amount: order.total,
        currency: order.currency,
      },
    });
    const result = await this.provider.createPayment({
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.number,
      amount: order.total,
      currency: order.currency,
    });
    return tx.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: result.providerPaymentId,
        status: result.status,
        redirectUrl: result.redirectUrl,
      },
    });
  }

  /**
   * Mock-only stand-in for the provider callback. Ownership is checked;
   * the outcome is decided by the (mock) provider, and only PENDING payments move.
   */
  async confirmMock(
    orderId: string,
    userId: string,
    outcome: 'success' | 'failure',
  ): Promise<Payment> {
    if (!(this.provider instanceof MockPaymentProvider)) throw AppException.notFound('Payment');
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { userId } },
      include: { order: { select: { status: true } } },
    });
    if (!payment || payment.provider !== this.provider.name) throw AppException.notFound('Payment');
    if (payment.status !== 'PENDING' || payment.order.status === 'CANCELLED') {
      throw AppException.conflict('PAYMENT_NOT_ALLOWED', 'Payment is not awaiting confirmation');
    }
    const { status, failureReason } = this.provider.simulate(outcome);
    return this.applyStatus(payment.id, 'PENDING', status, failureReason);
  }

  /** A failed card payment may be retried with a fresh provider payment. */
  async retry(orderId: string, userId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { userId } },
      include: { order: true },
    });
    if (!payment || payment.method !== 'CARD') throw AppException.notFound('Payment');
    if (payment.status !== 'FAILED' || payment.order.status !== 'PENDING') {
      throw AppException.conflict('PAYMENT_NOT_ALLOWED', 'Payment cannot be retried');
    }
    const result = await this.provider.createPayment({
      paymentId: payment.id,
      orderId,
      orderNumber: payment.order.number,
      amount: payment.amount,
      currency: payment.currency,
    });
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: result.providerPaymentId,
        status: result.status,
        redirectUrl: result.redirectUrl,
        failureReason: null,
      },
    });
  }

  /** Keeps the payment consistent with order lifecycle events (inside the status transaction). */
  async onOrderStatus(
    orderId: string,
    status: 'DELIVERED' | 'CANCELLED',
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const payment = await tx.payment.findUnique({ where: { orderId } });
    if (!payment) return;

    if (status === 'DELIVERED' && payment.method === 'CASH' && payment.status === 'PENDING') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
    }
    if (status === 'CANCELLED') {
      if (payment.status === 'SUCCEEDED' && payment.providerPaymentId) {
        const { status: refunded } = await this.provider.refund(
          payment.providerPaymentId,
          payment.amount,
        );
        await tx.payment.update({ where: { id: payment.id }, data: { status: refunded } });
        this.logger.log(`Payment ${payment.id} refunded for cancelled order ${orderId}`);
      } else if (['CREATED', 'PENDING', 'FAILED'].includes(payment.status)) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
      }
    }
  }

  private async applyStatus(
    paymentId: string,
    expected: PaymentStatus,
    next: PaymentStatus,
    failureReason: string | null,
  ): Promise<Payment> {
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: expected },
      data: { status: next, failureReason },
    });
    if (count !== 1)
      throw AppException.conflict('PAYMENT_NOT_ALLOWED', 'Payment state changed concurrently');
    this.logger.log(`Payment ${paymentId}: ${expected} -> ${next}`);
    return this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }
}
