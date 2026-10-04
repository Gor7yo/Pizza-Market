import type { CartItemInput } from '@market/shared';
import { describe, expect, it, vi } from 'vitest';
import { CartStore, type CartRemote } from './cart.store';

const pizza = {
  productId: 'p1',
  sizeId: 's30',
  crustId: 'classic',
  removedIngredientIds: [],
  extraIngredientIds: ['jalapeno'],
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

function remote(serverItems: { items: CartItemInput[] }) {
  return {
    replace: vi.fn().mockResolvedValue({ items: [] }),
    merge: vi.fn().mockResolvedValue(serverItems),
  } satisfies CartRemote;
}

describe('CartStore', () => {
  it('treats different configurations as different lines', () => {
    const cart = new CartStore(remote({ items: [] }));
    cart.add(pizza);
    cart.add(pizza);
    cart.add({ ...pizza, crustId: 'cheese' });
    expect(cart.lines).toHaveLength(2);
    expect(cart.count).toBe(3);
  });

  it('updates quantity, duplicates, replaces and removes lines', () => {
    const cart = new CartStore(remote({ items: [] }));
    cart.add(pizza);
    const key = cart.lines[0]!.key;
    cart.duplicate(key);
    expect(cart.count).toBe(2);
    cart.replace(key, { ...pizza, sizeId: 's35' }, 2);
    expect(cart.lines[0]!.sizeId).toBe('s35');
    cart.setQuantity(cart.lines[0]!.key, 0);
    expect(cart.isEmpty).toBe(true);
  });

  it('persists the anonymous cart and restores it', () => {
    const storage = memoryStorage();
    const first = new CartStore(remote({ items: [] }), storage);
    first.hydrate();
    first.add(pizza, 2);
    first.setPromoCode('welcome10');

    const second = new CartStore(remote({ items: [] }), storage);
    second.hydrate();
    expect(second.count).toBe(2);
    expect(second.promoCode).toBe('WELCOME10');
  });

  it('merges the local cart into the server cart on login without losing items', async () => {
    const server = remote({
      items: [
        { ...pizza, quantity: 3 },
        { ...pizza, productId: 'p2', quantity: 1 },
      ],
    });
    const cart = new CartStore(server);
    cart.add(pizza, 1);
    await cart.setAuthenticated(true);
    expect(server.merge).toHaveBeenCalledWith([
      expect.objectContaining({ productId: 'p1', quantity: 1 }),
    ]);
    expect(cart.count).toBe(4);
  });

  it('clears the device cart on logout', async () => {
    const cart = new CartStore(remote({ items: [{ ...pizza, quantity: 1 }] }));
    await cart.setAuthenticated(true);
    await cart.setAuthenticated(false);
    expect(cart.isEmpty).toBe(true);
  });
});
