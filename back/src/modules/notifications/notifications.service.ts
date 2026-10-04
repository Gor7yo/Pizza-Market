import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { localize } from '@market/shared';
import { asLocalized } from '../../common/utils/json';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  ORDER_EVENTS,
  type OrderCreatedEvent,
  type OrderStatusChangedEvent,
} from '../orders/order.events';
import {
  type Notification,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from './notification.types';

/** Subscribes to domain events and fans notifications out to every channel. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  @OnEvent(ORDER_EVENTS.created, { async: true, promisify: true })
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: { items: true, user: true },
    });
    if (!order) return;
    await this.dispatch(order.user, {
      type: 'order.created',
      orderId: order.id,
      orderNumber: order.number,
      total: order.total,
      currency: order.currency,
      items: order.items.map((i) => ({
        name: localize(asLocalized(i.name), order.user.locale),
        quantity: i.quantity,
      })),
    });
  }

  @OnEvent(ORDER_EVENTS.statusChanged, { async: true, promisify: true })
  async onStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.to === 'PENDING') return;
    const order = await this.prisma.order.findUnique({
      where: { id: event.orderId },
      include: { user: true },
    });
    if (!order) return;
    await this.dispatch(order.user, {
      type: 'order.status',
      orderId: order.id,
      orderNumber: order.number,
      status: event.to,
    });
  }

  private async dispatch(
    user: {
      id: string;
      email: string;
      firstName: string;
      locale: 'ru' | 'en' | 'hy';
      phone: string | null;
    },
    notification: Notification,
  ): Promise<void> {
    const recipient = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      locale: user.locale,
      phone: user.phone,
    };
    // A failing channel must not break the others (nor the request that emitted the event).
    const results = await Promise.allSettled(
      this.channels.map((c) => c.send(recipient, notification)),
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.error(
          { err: r.reason as unknown },
          `Notification ${notification.type} via ${this.channels[i]?.name} failed`,
        );
      }
    });
  }
}
