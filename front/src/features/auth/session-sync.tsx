'use client';
'use no memo';

import { useQueryClient } from '@tanstack/react-query';
import { reaction } from 'mobx';
import { useEffect } from 'react';
import { SESSION_EXPIRED_EVENT } from '@/lib/api/client';
import { qk } from '@/lib/query/keys';
import { useStores } from '@/stores/root-store';
import { useSession } from './use-session';

/**
 * Bridges server state (session) and client state (cart):
 * login -> merge anonymous cart into the server cart; logout -> clear device cart.
 */
export function SessionSync() {
  const { cart } = useStores();
  const { user, isLoading } = useSession();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isLoading) return;
    const apply = () => void cart.setAuthenticated(userId !== null);
    if (cart.hydrated) {
      apply();
      return;
    }
    // wait until the local cart is restored, otherwise the merge would send an empty cart
    return reaction(
      () => cart.hydrated,
      (hydrated, _prev, r) => {
        if (hydrated) {
          apply();
          r.dispose();
        }
      },
    );
  }, [cart, userId, isLoading]);

  useEffect(() => {
    const onExpired = () => queryClient.setQueryData(qk.me, null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  return null;
}
