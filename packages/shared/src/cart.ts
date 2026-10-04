export const MAX_ITEM_QUANTITY = 20;
export const MAX_CART_LINES = 50;

/** Everything that makes two cart lines different. Prices are never part of it. */
export interface CartItemConfig {
  productId: string;
  sizeId: string | null;
  crustId: string | null;
  removedIngredientIds: string[];
  extraIngredientIds: string[];
}

export interface CartItemInput extends CartItemConfig {
  quantity: number;
}

/** Stable identity of a configuration: same key => same line item. */
export function cartItemKey(config: CartItemConfig): string {
  const removed = [...new Set(config.removedIngredientIds)].sort().join(',');
  const extras = [...new Set(config.extraIngredientIds)].sort().join(',');
  return [config.productId, config.sizeId ?? '-', config.crustId ?? '-', removed, extras].join('|');
}

export function normalizeCartItem<T extends CartItemInput>(item: T): T {
  return {
    ...item,
    removedIngredientIds: [...new Set(item.removedIngredientIds)].sort(),
    extraIngredientIds: [...new Set(item.extraIngredientIds)].sort(),
    quantity: clampQuantity(item.quantity),
  };
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/**
 * Merges carts line by line (used when an anonymous cart meets the
 * user's server cart on login). Equal configurations sum their quantities.
 */
export function mergeCartItems(
  primary: readonly CartItemInput[],
  incoming: readonly CartItemInput[],
): CartItemInput[] {
  const byKey = new Map<string, CartItemInput>();
  for (const item of [...primary, ...incoming]) {
    const normalized = normalizeCartItem(item);
    const key = cartItemKey(normalized);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + normalized.quantity);
    } else {
      byKey.set(key, normalized);
    }
  }
  return [...byKey.values()].slice(0, MAX_CART_LINES);
}
