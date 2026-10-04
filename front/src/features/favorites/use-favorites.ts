'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSession } from '@/features/auth/use-session';
import { meApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';

/** Favorite ids for heart buttons; optimistic toggling with rollback on failure. */
export function useFavorites() {
  const { isAuthenticated } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('favorites');

  const ids = useQuery({
    queryKey: qk.favoriteIds,
    queryFn: meApi.favoriteIds,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const toggle = useMutation({
    mutationFn: ({ productId, add }: { productId: string; add: boolean }) =>
      add ? meApi.addFavorite(productId) : meApi.removeFavorite(productId),
    onMutate: async ({ productId, add }) => {
      await queryClient.cancelQueries({ queryKey: qk.favoriteIds });
      const previous = queryClient.getQueryData<string[]>(qk.favoriteIds) ?? [];
      queryClient.setQueryData<string[]>(
        qk.favoriteIds,
        add ? [...previous, productId] : previous.filter((id) => id !== productId),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(qk.favoriteIds, ctx.previous);
      toast.error(t('error'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.favorites });
    },
  });

  const set = new Set(ids.data ?? []);
  return {
    isFavorite: (productId: string) => set.has(productId),
    toggle: (productId: string) => {
      if (!isAuthenticated) {
        toast.info(t('loginRequired'), {
          action: {
            label: t('login'),
            onClick: () =>
              router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`),
          },
        });
        return;
      }
      toggle.mutate({ productId, add: !set.has(productId) });
    },
  };
}
