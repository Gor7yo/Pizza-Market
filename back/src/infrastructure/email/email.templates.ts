import type { Locale, OrderStatus } from '@market/shared';
import type { EmailJob, EmailMessage } from './email.types';

const BRAND = 'Tonir Pizza';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#d9480f">${BRAND}</p>
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#78716c">${BRAND}</p>
</td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#d9480f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">${escapeHtml(label)}</a></p>`;
}

const STATUS_LABELS: Record<Locale, Record<OrderStatus, string>> = {
  ru: {
    PENDING: 'Принят',
    CONFIRMED: 'Подтверждён',
    PREPARING: 'Готовится',
    READY: 'Готов',
    OUT_FOR_DELIVERY: 'В пути',
    DELIVERED: 'Доставлен',
    CANCELLED: 'Отменён',
  },
  en: {
    PENDING: 'Received',
    CONFIRMED: 'Confirmed',
    PREPARING: 'Preparing',
    READY: 'Ready',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  },
  hy: {
    PENDING: 'Ընդունված է',
    CONFIRMED: 'Հաստատված է',
    PREPARING: 'Պատրաստվում է',
    READY: 'Պատրաստ է',
    OUT_FOR_DELIVERY: 'Ճանապարհին է',
    DELIVERED: 'Առաքված է',
    CANCELLED: 'Չեղարկված է',
  },
};

const T = {
  ru: {
    hi: (n: string) => `Здравствуйте, ${n}!`,
    verifySubject: 'Код подтверждения',
    verifyText: (code: string, m: number) =>
      `Ваш код подтверждения: ${code}. Код действует ${m} минут. Если вы не регистрировались, просто проигнорируйте письмо.`,
    resetSubject: 'Сброс пароля',
    resetText: (m: number) =>
      `Мы получили запрос на сброс пароля. Ссылка действует ${m} минут. Если это были не вы, проигнорируйте письмо.`,
    resetButton: 'Задать новый пароль',
    changedSubject: 'Пароль изменён',
    changedText:
      'Пароль вашего аккаунта был изменён, все сеансы завершены. Если это были не вы, срочно восстановите доступ через «Забыли пароль».',
    orderSubject: (n: number) => `Заказ #${n} принят`,
    orderText: (n: number, total: string) => `Спасибо! Ваш заказ #${n} на сумму ${total} принят.`,
    statusSubject: (n: number) => `Заказ #${n}: новый статус`,
    statusText: (n: number, s: string) => `Статус заказа #${n}: ${s}.`,
    track: 'Отследить заказ',
  },
  en: {
    hi: (n: string) => `Hi ${n}!`,
    verifySubject: 'Your verification code',
    verifyText: (code: string, m: number) =>
      `Your verification code is ${code}. It is valid for ${m} minutes. If you did not sign up, just ignore this e-mail.`,
    resetSubject: 'Reset your password',
    resetText: (m: number) =>
      `We received a request to reset your password. The link is valid for ${m} minutes. If it wasn't you, ignore this e-mail.`,
    resetButton: 'Set a new password',
    changedSubject: 'Your password was changed',
    changedText:
      'Your account password was changed and all sessions were signed out. If it was not you, recover access via "Forgot password" immediately.',
    orderSubject: (n: number) => `Order #${n} received`,
    orderText: (n: number, total: string) =>
      `Thank you! Your order #${n} (${total}) has been received.`,
    statusSubject: (n: number) => `Order #${n} status update`,
    statusText: (n: number, s: string) => `Order #${n} status: ${s}.`,
    track: 'Track order',
  },
  hy: {
    hi: (n: string) => `Բարև, ${n}։`,
    verifySubject: 'Հաստատման կոդ',
    verifyText: (code: string, m: number) =>
      `Ձեր հաստատման կոդն է՝ ${code}։ Կոդը գործում է ${m} րոպե։ Եթե չեք գրանցվել, անտեսեք այս նամակը։`,
    resetSubject: 'Գաղտնաբառի վերականգնում',
    resetText: (m: number) =>
      `Մենք ստացել ենք գաղտնաբառի վերականգնման հարցում։ Հղումը գործում է ${m} րոպե։ Եթե դա դուք չեք, անտեսեք նամակը։`,
    resetButton: 'Սահմանել նոր գաղտնաբառ',
    changedSubject: 'Գաղտնաբառը փոխված է',
    changedText:
      'Ձեր հաշվի գաղտնաբառը փոխվել է, բոլոր սեանսները փակվել են։ Եթե դա դուք չեք, անմիջապես վերականգնեք մուտքը։',
    orderSubject: (n: number) => `Պատվեր #${n}-ն ընդունված է`,
    orderText: (n: number, total: string) =>
      `Շնորհակալություն։ Ձեր #${n} պատվերը (${total}) ընդունված է։`,
    statusSubject: (n: number) => `Պատվեր #${n}՝ նոր կարգավիճակ`,
    statusText: (n: number, s: string) => `Պատվեր #${n}-ի կարգավիճակը՝ ${s}։`,
    track: 'Հետևել պատվերին',
  },
} as const;

/** Renders a transactional e-mail; all interpolated values are HTML-escaped. */
export function renderEmail(job: EmailJob): EmailMessage {
  const t = T[job.locale];
  const hi = t.hi(job.data.firstName);
  const p = (text: string) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(text)}</p>`;

  switch (job.template) {
    case 'verify-email': {
      const text = t.verifyText(job.data.code, job.data.ttlMinutes);
      const codeHtml = `<p style="margin:16px 0;font-size:32px;letter-spacing:8px;font-weight:700">${escapeHtml(job.data.code)}</p>`;
      return {
        to: job.to,
        subject: t.verifySubject,
        text: `${hi}\n\n${text}`,
        html: layout(t.verifySubject, p(hi) + codeHtml + p(text)),
      };
    }
    case 'password-reset': {
      const text = t.resetText(job.data.ttlMinutes);
      return {
        to: job.to,
        subject: t.resetSubject,
        text: `${hi}\n\n${text}\n\n${job.data.url}`,
        html: layout(t.resetSubject, p(hi) + p(text) + button(job.data.url, t.resetButton)),
      };
    }
    case 'password-changed':
      return {
        to: job.to,
        subject: t.changedSubject,
        text: `${hi}\n\n${t.changedText}`,
        html: layout(t.changedSubject, p(hi) + p(t.changedText)),
      };
    case 'order-created': {
      const { orderNumber, total, url, items } = job.data;
      const text = t.orderText(orderNumber, total);
      const list = items.map((i) => `• ${i.name} × ${i.quantity}`).join('\n');
      const listHtml = `<ul style="padding-left:18px;margin:0 0 12px">${items
        .map((i) => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`)
        .join('')}</ul>`;
      return {
        to: job.to,
        subject: t.orderSubject(orderNumber),
        text: `${hi}\n\n${text}\n\n${list}\n\n${url}`,
        html: layout(
          t.orderSubject(orderNumber),
          p(hi) + p(text) + listHtml + button(url, t.track),
        ),
      };
    }
    case 'order-status': {
      const { orderNumber, status, url } = job.data;
      const text = t.statusText(orderNumber, STATUS_LABELS[job.locale][status]);
      return {
        to: job.to,
        subject: t.statusSubject(orderNumber),
        text: `${hi}\n\n${text}\n\n${url}`,
        html: layout(t.statusSubject(orderNumber), p(hi) + p(text) + button(url, t.track)),
      };
    }
  }
}
