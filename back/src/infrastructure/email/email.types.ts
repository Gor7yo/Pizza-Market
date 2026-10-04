import type { Locale, OrderStatus } from '@market/shared';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailJob =
  | {
      template: 'verify-email';
      to: string;
      locale: Locale;
      data: { firstName: string; code: string; ttlMinutes: number };
    }
  | {
      template: 'password-reset';
      to: string;
      locale: Locale;
      data: { firstName: string; url: string; ttlMinutes: number };
    }
  | {
      template: 'password-changed';
      to: string;
      locale: Locale;
      data: { firstName: string };
    }
  | {
      template: 'order-created';
      to: string;
      locale: Locale;
      data: {
        firstName: string;
        orderNumber: number;
        total: string;
        url: string;
        items: { name: string; quantity: number }[];
      };
    }
  | {
      template: 'order-status';
      to: string;
      locale: Locale;
      data: { firstName: string; orderNumber: number; status: OrderStatus; url: string };
    };

export type EmailTemplate = EmailJob['template'];

/** Templates whose payload contains secrets: jobs are removed right after processing. */
export const SENSITIVE_TEMPLATES: ReadonlySet<EmailTemplate> = new Set([
  'verify-email',
  'password-reset',
]);
