import { describe, expect, it } from 'vitest';
import {
  calculateDeliveryFee,
  calculateDiscount,
  calculateLineTotal,
  calculateTotals,
  calculateUnitPrice,
} from './pricing';

describe('pricing', () => {
  it('adds base, size, crust and extras', () => {
    expect(
      calculateUnitPrice({
        basePrice: 3500,
        sizeModifier: 1000,
        crustModifier: 500,
        extraPrices: [400, 300],
      }),
    ).toBe(5700);
  });

  it('multiplies line totals by quantity', () => {
    expect(calculateLineTotal(5700, 3)).toBe(17100);
  });

  it('caps percent discounts by maxDiscount and subtotal', () => {
    expect(calculateDiscount({ type: 'PERCENT', value: 20, maxDiscount: null }, 10000)).toBe(2000);
    expect(calculateDiscount({ type: 'PERCENT', value: 50, maxDiscount: 3000 }, 10000)).toBe(3000);
    expect(calculateDiscount({ type: 'FIXED', value: 15000, maxDiscount: null }, 10000)).toBe(
      10000,
    );
    expect(calculateDiscount({ type: 'FIXED', value: 1000, maxDiscount: null }, 0)).toBe(0);
  });

  it('charges delivery unless pickup or threshold reached', () => {
    const pricing = { deliveryFee: 800, freeDeliveryThreshold: 10000 };
    expect(calculateDeliveryFee('PICKUP', 500, pricing)).toBe(0);
    expect(calculateDeliveryFee('DELIVERY', 9999, pricing)).toBe(800);
    expect(calculateDeliveryFee('DELIVERY', 10000, pricing)).toBe(0);
    expect(
      calculateDeliveryFee('DELIVERY', 50000, { ...pricing, freeDeliveryThreshold: null }),
    ).toBe(800);
  });

  it('computes final totals', () => {
    expect(calculateTotals(12000, 2000, 800)).toEqual({
      subtotal: 12000,
      discount: 2000,
      deliveryFee: 800,
      total: 10800,
    });
    expect(calculateTotals(1000, 5000, 0).total).toBe(0);
  });
});
