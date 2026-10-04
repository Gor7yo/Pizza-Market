/**
 * Money is ALWAYS an integer amount of minor units of a currency.
 * AMD is treated as having 0 fraction digits (luma are not used in practice),
 * USD and RUB have 2. Floating point arithmetic is never used for money.
 */
export const CURRENCIES = ['AMD', 'USD', 'RUB'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface CurrencyMeta {
  code: Currency;
  fractionDigits: number;
  symbol: string;
}

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  AMD: { code: 'AMD', fractionDigits: 0, symbol: '֏' },
  USD: { code: 'USD', fractionDigits: 2, symbol: '$' },
  RUB: { code: 'RUB', fractionDigits: 2, symbol: '₽' },
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export class MoneyError extends Error {}

export function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`Money amount must be a safe integer of minor units, got ${amount}`);
  }
}

export function sumMoney(amounts: readonly number[]): number {
  let total = 0;
  for (const a of amounts) {
    assertMinorUnits(a);
    total += a;
  }
  assertMinorUnits(total);
  return total;
}

export function multiplyMoney(amount: number, quantity: number): number {
  assertMinorUnits(amount);
  if (!Number.isSafeInteger(quantity)) throw new MoneyError('Quantity must be an integer');
  const result = amount * quantity;
  assertMinorUnits(result);
  return result;
}

/** percent is an integer 0..100. Rounds half up, using integer math only. */
export function percentOf(amount: number, percent: number): number {
  assertMinorUnits(amount);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new MoneyError('Percent must be an integer between 0 and 100');
  }
  return Math.floor((amount * percent + 50) / 100);
}

/** Converts a major-unit decimal string ("10.50") to minor units. */
export function parseMajorToMinor(value: string, currency: Currency): number {
  const digits = CURRENCY_META[currency].fractionDigits;
  const match = /^(-)?(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if (!match) throw new MoneyError(`Invalid money value "${value}"`);
  const [, sign, whole = '0', fraction = ''] = match;
  if (fraction.length > digits) {
    throw new MoneyError(`${currency} supports at most ${digits} fraction digits`);
  }
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0');
  assertMinorUnits(minor);
  return sign ? -minor : minor;
}

/** Formats minor units to a major-unit decimal string ("10.50") without symbols. */
export function formatMinorToMajor(amount: number, currency: Currency): string {
  assertMinorUnits(amount);
  const digits = CURRENCY_META[currency].fractionDigits;
  if (digits === 0) return String(amount);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const divisor = 10 ** digits;
  const whole = Math.floor(abs / divisor);
  const fraction = String(abs % divisor).padStart(digits, '0');
  return `${sign}${whole}.${fraction}`;
}

const INTL_LOCALE: Record<string, string> = { ru: 'ru-RU', en: 'en-US', hy: 'hy-AM' };

export function formatMoney(amount: number, currency: Currency, locale = 'ru'): string {
  assertMinorUnits(amount);
  const { fractionDigits, symbol } = CURRENCY_META[currency];
  // Intl formats numbers; the integer->decimal step is exact because
  // amount / 10^digits only ever needs `digits` fraction digits.
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale] ?? locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(formatMinorToMajor(amount, currency)));
  return currency === 'USD' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

/**
 * Display-only exchange rates. They are configured manually by an admin
 * (no live feed) and the UI always marks converted prices as approximate.
 * `rates[c]` = how many major units of `c` equal one major unit of `base`,
 * stored as a decimal string to avoid float errors.
 */
export interface ExchangeRates {
  base: Currency;
  rates: Partial<Record<Currency, string>>;
  updatedAt: string | null;
}

function parseDecimal(value: string): { numerator: bigint; scale: bigint } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new MoneyError(`Invalid exchange rate "${value}"`);
  const [, whole = '0', fraction = ''] = match;
  return {
    numerator: BigInt(whole + fraction),
    scale: 10n ** BigInt(fraction.length),
  };
}

/** Converts minor units of `rates.base` into minor units of `to` (rounded half up). */
export function convertMoney(amount: number, to: Currency, rates: ExchangeRates): number | null {
  assertMinorUnits(amount);
  if (to === rates.base) return amount;
  const rate = rates.rates[to];
  if (!rate) return null;
  const { numerator, scale } = parseDecimal(rate);
  const fromDigits = 10n ** BigInt(CURRENCY_META[rates.base].fractionDigits);
  const toDigits = 10n ** BigInt(CURRENCY_META[to].fractionDigits);
  const top = BigInt(amount) * numerator * toDigits;
  const bottom = scale * fromDigits;
  const result = (top * 2n + bottom) / (bottom * 2n);
  return Number(result);
}
