import type { ResolvedLine } from './pricing.service';
import { evaluatePromo, type PromoWithScope } from './promo.service';

const now = new Date('2026-06-01T12:00:00Z');

function promo(overrides: Partial<PromoWithScope> = {}): PromoWithScope {
  return {
    id: 'promo-1',
    code: 'TEST',
    description: null,
    type: 'PERCENT',
    value: 10,
    maxDiscount: null,
    minOrderAmount: 0,
    startsAt: null,
    expiresAt: null,
    usageLimit: null,
    perUserLimit: null,
    usedCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    products: [],
    categories: [],
    ...overrides,
  };
}

function line(
  productId: string,
  categoryId: string,
  lineTotal: number,
  available = true,
): ResolvedLine {
  return {
    key: productId,
    input: {
      productId,
      sizeId: null,
      crustId: null,
      removedIngredientIds: [],
      extraIngredientIds: [],
      quantity: 1,
    },
    available,
    reason: available ? null : 'PRODUCT_UNAVAILABLE',
    product: {
      id: productId,
      slug: productId,
      name: {},
      imageKey: null,
      categoryId,
      basePrice: lineTotal,
    },
    size: null,
    crust: null,
    removed: [],
    extras: [],
    unitPrice: lineTotal,
    lineTotal,
  };
}

const cart = [line('pizza-1', 'cat-pizza', 6000), line('cola', 'cat-drinks', 1000)];

describe('evaluatePromo', () => {
  it('applies a percent discount to the whole cart', () => {
    const r = evaluatePromo(promo(), cart, now, null);
    expect(r).toMatchObject({ ok: true, discount: 700 });
  });

  it('rejects unknown, inactive, expired and not started codes', () => {
    expect(evaluatePromo(null, cart, now, null)).toMatchObject({
      ok: false,
      errorCode: 'PROMO_NOT_FOUND',
    });
    expect(evaluatePromo(promo({ isActive: false }), cart, now, null)).toMatchObject({
      errorCode: 'PROMO_INACTIVE',
    });
    expect(
      evaluatePromo(promo({ expiresAt: new Date('2026-05-01') }), cart, now, null),
    ).toMatchObject({
      errorCode: 'PROMO_EXPIRED',
    });
    expect(
      evaluatePromo(promo({ startsAt: new Date('2026-07-01') }), cart, now, null),
    ).toMatchObject({
      errorCode: 'PROMO_NOT_STARTED',
    });
  });

  it('enforces minimum order, global and per-user limits', () => {
    expect(evaluatePromo(promo({ minOrderAmount: 8000 }), cart, now, null)).toMatchObject({
      errorCode: 'PROMO_MIN_ORDER',
    });
    expect(evaluatePromo(promo({ usageLimit: 5, usedCount: 5 }), cart, now, null)).toMatchObject({
      errorCode: 'PROMO_USAGE_LIMIT',
    });
    expect(evaluatePromo(promo({ perUserLimit: 1 }), cart, now, 1)).toMatchObject({
      errorCode: 'PROMO_USAGE_LIMIT',
    });
    // anonymous quotes skip the per-user check (re-checked at checkout)
    expect(evaluatePromo(promo({ perUserLimit: 1 }), cart, now, null)).toMatchObject({ ok: true });
  });

  it('discounts only eligible categories', () => {
    const r = evaluatePromo(
      promo({ value: 50, categories: [{ id: 'cat-pizza' }] }),
      cart,
      now,
      null,
    );
    expect(r).toMatchObject({ ok: true, discount: 3000 });
    expect(
      evaluatePromo(promo({ categories: [{ id: 'cat-desserts' }] }), cart, now, null),
    ).toMatchObject({
      errorCode: 'PROMO_NOT_APPLICABLE',
    });
  });

  it('ignores unavailable lines and caps fixed discounts by the subtotal', () => {
    const lines = [line('pizza-1', 'cat-pizza', 2000), line('gone', 'cat-pizza', 5000, false)];
    expect(evaluatePromo(promo({ type: 'FIXED', value: 5000 }), lines, now, null)).toMatchObject({
      ok: true,
      discount: 2000,
    });
  });
});
