'use client';
// MobX state is read here; React Compiler memoization would freeze the first snapshot
'use no memo';

import type { FulfillmentType } from '@market/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toJS } from 'mobx';
import { cartApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';
import type { CartStore } from '@/stores/cart.store';

/**
 * Prices for the current cart, always from the API (MobX holds only configurations).
 * Call from an observer component: it reads observable cart state.
 */
export function useCartQuote(cart: CartStore, fulfillment: FulfillmentType = 'DELIVERY') {
  const payload = {
    // plain snapshot: stable query-key hashing and a clean JSON body
    items: toJS(cart.items),
    promoCode: cart.promoCode ?? undefined,
    fulfillment,
  };
  return useQuery({
    queryKey: qk.cartQuote(payload),
    queryFn: () => cartApi.quote(payload),
    enabled: cart.hydrated && payload.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
