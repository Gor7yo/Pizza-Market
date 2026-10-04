'use client';
'use no memo';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { cartApi } from '@/lib/api/endpoints';
import { CartStore } from './cart.store';
import { CheckoutStore } from './checkout.store';
import { UiStore } from './ui.store';

export class RootStore {
  readonly cart: CartStore;
  readonly ui: UiStore;
  readonly checkout: CheckoutStore;

  constructor(storage: Storage | null) {
    this.cart = new CartStore(cartApi, storage);
    this.ui = new UiStore(storage);
    this.checkout = new CheckoutStore();
  }
}

const StoreContext = createContext<RootStore | null>(null);

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * One MobX root store per browser tab. Persisted state is hydrated after mount,
 * so server and first client render match (no hydration mismatch).
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new RootStore(safeLocalStorage()));

  useEffect(() => {
    store.cart.hydrate();
    const disposeUi = store.ui.hydrate();
    return () => {
      disposeUi();
      store.cart.dispose();
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStores(): RootStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStores must be used inside <StoreProvider>');
  return store;
}
