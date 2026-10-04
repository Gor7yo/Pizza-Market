'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { useSession } from '@/features/auth/use-session';
import { ProductGrid, ProductGridSkeleton } from '@/features/catalog/product-card';
import { meApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';

export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  const { isAuthenticated, isLoading } = useSession();
  const favorites = useQuery({
    queryKey: qk.favorites,
    queryFn: meApi.favorites,
    enabled: isAuthenticated,
  });

  return (
    <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-5)' }}>{t('title')}</h1>
      {!isLoading && !isAuthenticated ? (
        <EmptyState
          icon={Heart}
          title={t('guestTitle')}
          text={t('guestText')}
          action={
            <Button href="/login?next=/favorites" variant="primary">
              {t('login')}
            </Button>
          }
        />
      ) : favorites.isPending ? (
        <ProductGridSkeleton count={4} />
      ) : favorites.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void favorites.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : favorites.data.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            <Button href="/menu" variant="primary">
              {t('toMenu')}
            </Button>
          }
        />
      ) : (
        <ProductGrid products={favorites.data} />
      )}
    </div>
  );
}
