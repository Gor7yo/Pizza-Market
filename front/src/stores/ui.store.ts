import { type Currency, isCurrency } from '@market/shared';
import { makeAutoObservable, reaction } from 'mobx';

const STORAGE_KEY = 'market.ui.v1';

/** Transient UI state + local display preferences. */
export class UiStore {
  cartOpen = false;
  /** Currency used for approximate price hints (orders are always charged in the store currency) */
  displayCurrency: Currency | null = null;

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    makeAutoObservable<UiStore, 'storage'>(this, { storage: false }, { autoBind: true });
  }

  hydrate(): () => void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { displayCurrency?: unknown }) : {};
      if (isCurrency(parsed.displayCurrency)) this.displayCurrency = parsed.displayCurrency;
    } catch {
      // ignore corrupted preferences
    }
    return reaction(
      () => this.displayCurrency,
      (displayCurrency) => {
        try {
          this.storage?.setItem(STORAGE_KEY, JSON.stringify({ displayCurrency }));
        } catch {
          // ignore
        }
      },
    );
  }

  openCart(): void {
    this.cartOpen = true;
  }

  closeCart(): void {
    this.cartOpen = false;
  }

  setDisplayCurrency(currency: Currency | null): void {
    this.displayCurrency = currency;
  }
}
