import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfig } from '../../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import type { EmailMessage } from './email.types';

/** Transport abstraction: business code never talks to a provider SDK directly. */
export abstract class EmailProvider {
  abstract send(message: EmailMessage): Promise<void>;
}

@Injectable()
export class ResendEmailProvider extends EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(config: AppConfig) {
    super();
    this.client = new Resend(config.get('RESEND_API_KEY'));
    this.from = config.get('EMAIL_FROM');
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    // Throwing lets BullMQ retry with backoff.
    if (error) throw new Error(`Resend error: ${error.name}: ${error.message}`);
  }
}

export const DEV_MAILBOX_KEY = 'dev:mailbox';

/**
 * Development transport: logs the e-mail and (when dev endpoints are enabled)
 * keeps the last messages in Redis so E2E tests can read verification codes.
 * Env validation forbids this provider in production.
 */
@Injectable()
export class ConsoleEmailProvider extends EmailProvider {
  private readonly logger = new Logger('Email');

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`[dev e-mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
    if (this.config.get('DEV_ENDPOINTS_ENABLED')) {
      const entry = JSON.stringify({ ...message, sentAt: new Date().toISOString() });
      await this.redis.client
        .multi()
        .lpush(DEV_MAILBOX_KEY, entry)
        .ltrim(DEV_MAILBOX_KEY, 0, 49)
        .expire(DEV_MAILBOX_KEY, 24 * 3600)
        .exec();
    }
  }
}
