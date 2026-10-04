import { Injectable } from '@nestjs/common';
import { formatMoney } from '@market/shared';
import { AppConfig } from '../../config/app-config.service';
import { EmailService } from '../../infrastructure/email/email.service';
import {
  type Notification,
  NotificationChannel,
  type NotificationRecipient,
} from './notification.types';

@Injectable()
export class EmailNotificationChannel extends NotificationChannel {
  readonly name = 'email';

  constructor(
    private readonly email: EmailService,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async send(recipient: NotificationRecipient, n: Notification): Promise<void> {
    const url = `${this.config.get('PUBLIC_WEB_URL')}/orders/${n.orderId}`;
    if (n.type === 'order.created') {
      await this.email.send(
        {
          template: 'order-created',
          to: recipient.email,
          locale: recipient.locale,
          data: {
            firstName: recipient.firstName,
            orderNumber: n.orderNumber,
            total: formatMoney(n.total, n.currency, recipient.locale),
            url,
            items: n.items,
          },
        },
        `order-created:${n.orderId}`,
      );
      return;
    }
    await this.email.send(
      {
        template: 'order-status',
        to: recipient.email,
        locale: recipient.locale,
        data: { firstName: recipient.firstName, orderNumber: n.orderNumber, status: n.status, url },
      },
      `order-status:${n.orderId}:${n.status}`,
    );
  }
}
