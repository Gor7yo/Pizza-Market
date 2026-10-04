import { describe, expect, it } from 'vitest';
import {
  convertMoney,
  formatMinorToMajor,
  MoneyError,
  parseMajorToMinor,
  percentOf,
  sumMoney,
} from './money';

describe('money', () => {
  it('sums integer minor units', () => {
    expect(sumMoney([1200, 300, 0])).toBe(1500);
  });

  it('rejects fractional amounts', () => {
    expect(() => sumMoney([10.5])).toThrow(MoneyError);
  });

  it('computes percent with half-up rounding', () => {
    expect(percentOf(1999, 10)).toBe(200);
    expect(percentOf(1995, 10)).toBe(200);
    expect(percentOf(1994, 10)).toBe(199);
    expect(percentOf(5000, 0)).toBe(0);
    expect(() => percentOf(100, 101)).toThrow(MoneyError);
  });

  it('parses and formats major units per currency', () => {
    expect(parseMajorToMinor('10.50', 'USD')).toBe(1050);
    expect(parseMajorToMinor('10,5', 'USD')).toBe(1050);
    expect(parseMajorToMinor('4500', 'AMD')).toBe(4500);
    expect(() => parseMajorToMinor('10.5', 'AMD')).toThrow(MoneyError);
    expect(formatMinorToMajor(1050, 'USD')).toBe('10.50');
    expect(formatMinorToMajor(5, 'RUB')).toBe('0.05');
    expect(formatMinorToMajor(4500, 'AMD')).toBe('4500');
  });

  it('converts with decimal rates without float drift', () => {
    const rates = { base: 'AMD' as const, rates: { USD: '0.0026', RUB: '0.21' }, updatedAt: null };
    // 4500 AMD * 0.0026 = 11.70 USD
    expect(convertMoney(4500, 'USD', rates)).toBe(1170);
    // 4500 AMD * 0.21 = 945.00 RUB
    expect(convertMoney(4500, 'RUB', rates)).toBe(94500);
    expect(convertMoney(4500, 'AMD', rates)).toBe(4500);
    expect(convertMoney(4500, 'USD', { ...rates, rates: {} })).toBeNull();
  });
});
