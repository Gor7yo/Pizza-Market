import { describe, expect, it } from 'vitest';
import { cartItemKey, MAX_ITEM_QUANTITY, mergeCartItems } from './cart';

const base = {
  productId: 'p1',
  sizeId: 's1',
  crustId: 'c1',
  removedIngredientIds: [] as string[],
  extraIngredientIds: ['b', 'a'],
  quantity: 1,
};

describe('cart', () => {
  it('builds order-independent keys', () => {
    expect(cartItemKey(base)).toBe(cartItemKey({ ...base, extraIngredientIds: ['a', 'b'] }));
    expect(cartItemKey(base)).not.toBe(cartItemKey({ ...base, sizeId: 's2' }));
  });

  it('merges identical configurations and caps quantity', () => {
    const merged = mergeCartItems(
      [{ ...base, quantity: 15 }],
      [
        { ...base, quantity: 10 },
        { ...base, crustId: null, quantity: 2 },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.quantity).toBe(MAX_ITEM_QUANTITY);
    expect(merged[1]!.quantity).toBe(2);
  });
});
