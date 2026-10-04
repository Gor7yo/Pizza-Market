import {
  type CartItemConfig,
  type CartItemInput,
  cartItemKey,
  clampQuantity,
  MAX_CART_LINES,
  mergeCartItems,
  normalizeCartItem,
} from '@market/shared';
import { makeAutoObservable, reaction, runInAction } from 'mobx';

const STORAGE_KEY = 'market.cart.v1';
const SYNC_DEBOUNCE_MS = 600;

export interface CartLine extends CartItemInput {
  key: string;
}

/** Remote persistence used by the store (injected so the store stays testable). */
export interface CartRemote {
  replace(items: CartItemInput[]): Promise<{ items: CartItemInput[] }>;
  merge(items: CartItemInput[]): Promise<{ items: CartItemInput[] }>;
}

interface Persisted {
  items: CartItemInput[];
  promoCode: string | null;
}

/**
 * Client-side cart: configurations + quantities only (prices come from the API quote).
 * Anonymous carts live in localStorage; once authenticated the cart is merged with
 * the server cart and every change is synced (debounced) so it follows the user.
 */
export class CartStore {
  items: CartItemInput[] = [];
  promoCode: string | null = null;
  hydrated = false;
  authenticated = false;
  syncing = false;

  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private disposers: (() => void)[] = [];

  constructor(
    private readonly remote: CartRemote,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = null,
  ) {
    makeAutoObservable<CartStore, 'syncTimer' | 'disposers' | 'remote' | 'storage'>(
      this,
      { syncTimer: false, disposers: false, remote: false, storage: false },
      { autoBind: true },
    );
  }

  get lines(): CartLine[] {
    return this.items.map((i) => ({ ...i, key: cartItemKey(i) }));
  }

  get count(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  quantityOf(productId: string): number {
    return this.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0);
  }

  add(config: CartItemConfig, quantity = 1): void {
    const item = normalizeCartItem({ ...config, quantity });
    const key = cartItemKey(item);
    const existing = this.items.find((i) => cartItemKey(i) === key);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + item.quantity);
    } else if (this.items.length < MAX_CART_LINES) {
      this.items.push(item);
    }
  }

  setQuantity(key: string, quantity: number): void {
    if (quantity <= 0) {
      this.remove(key);
      return;
    }
    const item = this.items.find((i) => cartItemKey(i) === key);
    if (item) item.quantity = clampQuantity(quantity);
  }

  /** "One more like this" - the same configuration is the same line. */
  duplicate(key: string): void {
    const item = this.items.find((i) => cartItemKey(i) === key);
    if (item) item.quantity = clampQuantity(item.quantity + 1);
  }

  /** Re-configured line: replaces the old configuration, merging if it now equals another line. */
  replace(key: string, config: CartItemConfig, quantity: number): void {
    const index = this.items.findIndex((i) => cartItemKey(i) === key);
    if (index === -1) return;
    this.items.splice(index, 1);
    this.add(config, quantity);
  }

  remove(key: string): void {
    this.items = this.items.filter((i) => cartItemKey(i) !== key);
  }

  clear(): void {
    this.items = [];
    this.promoCode = null;
  }

  setPromoCode(code: string | null): void {
    this.promoCode = code ? code.trim().toUpperCase() : null;
  }

  addMany(items: CartItemInput[]): void {
    this.items = mergeCartItems(this.items, items);
  }

  /** Loads the anonymous cart from localStorage and starts persistence/sync reactions. */
  hydrate(): void {
    if (this.hydrated) return;
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        this.items = mergeCartItems([], Array.isArray(parsed.items) ? parsed.items : []);
        this.promoCode = typeof parsed.promoCode === 'string' ? parsed.promoCode : null;
      }
    } catch {
      this.items = [];
    }
    this.hydrated = true;

    this.disposers.push(
      reaction(
        () => JSON.stringify({ items: this.items, promoCode: this.promoCode }),
        (snapshot) => {
          try {
            this.storage?.setItem(STORAGE_KEY, snapshot);
          } catch {
            // storage full / private mode: the cart still works in memory
          }
        },
      ),
      reaction(
        () => JSON.stringify(this.items),
        () => this.scheduleSync(),
      ),
    );
  }

  /**
   * Called when the auth state becomes known. On login the local cart is merged
   * into the server cart (nothing is lost); on logout the device cart is cleared.
   */
  async setAuthenticated(value: boolean): Promise<void> {
    if (value === this.authenticated) return;
    this.authenticated = value;
    if (!value) {
      this.clear();
      return;
    }
    this.syncing = true;
    try {
      const merged = await this.remote.merge(this.items);
      runInAction(() => {
        this.items = mergeCartItems([], merged.items);
      });
    } catch {
      // keep the local cart; the next change will sync it
    } finally {
      runInAction(() => {
        this.syncing = false;
      });
    }
  }

  private scheduleSync(): void {
    if (!this.authenticated || this.syncing) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      void this.remote.replace(this.items).catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    if (this.syncTimer) clearTimeout(this.syncTimer);
  }
}
