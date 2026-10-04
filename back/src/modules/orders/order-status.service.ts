import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { canTransition, type OrderStatus } from '@market/shared';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { ORDER_EVENTS, type OrderStatusChangedEvent } from './order.events';

export interface TransitionActor {
  userId: string;
  kind: 'customer' | 'admin';
  client?: ClientInfo;
}

/**
 * The only place where order status changes. Enforces the transition graph,
 * uses optimistic locking on the current status, writes history + audit log
 * atomically, keeps the payment in sync and publishes a domain event.
 */
@Injectable()
export class OrderStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async transition(
    orderId: string,
    to: OrderStatus,
    actor: TransitionActor,
    note?: string,
  ): Promise<void> {
    const event = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { payment: true },
      });
      if (!order) throw AppException.notFound('Order');

      const from = order.status;
      if (!canTransition(from, to, order.fulfillment)) {
        throw AppException.unprocessable(
          'INVALID_STATUS_TRANSITION',
          `Cannot change status from ${from} to ${to}`,
        );
      }
      if (
        to === 'CONFIRMED' &&
        order.payment?.method === 'CARD' &&
        order.payment.status !== 'SUCCEEDED'
      ) {
        throw AppException.unprocessable(
          'INVALID_STATUS_TRANSITION',
          'Card payment is not completed yet',
        );
      }

      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data: { status: to },
      });
      if (count !== 1) throw AppException.conflict('CONFLICT', 'Order was updated concurrently');

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: from,
          toStatus: to,
          note: note ?? null,
          changedById: actor.userId,
        },
      });

      if (to === 'DELIVERED' || to === 'CANCELLED')
        await this.payments.onOrderStatus(orderId, to, tx);

      if (to === 'CANCELLED') {
        // popularity counters reflect only non-cancelled orders
        const items = await tx.orderItem.findMany({ where: { orderId, productId: { not: null } } });
        for (const item of items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { soldCount: { decrement: item.quantity } },
            });
          }
        }
      }

      if (actor.kind === 'admin') {
        await this.audit.log(
          {
            actorId: actor.userId,
            action: 'order.status_change',
            entityType: 'Order',
            entityId: orderId,
            metadata: { orderNumber: order.number, from, to, note },
            client: actor.client,
          },
          tx,
        );
      }
      return { orderId, from, to } satisfies OrderStatusChangedEvent;
    });

    // published only after commit
    this.events.emit(ORDER_EVENTS.statusChanged, event);
  }
}
