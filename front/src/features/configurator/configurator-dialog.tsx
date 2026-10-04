'use client';

import type { CartItemInput } from '@market/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { catalogApi } from '@/lib/api/endpoints';
import { useLocalize } from '@/lib/i18n-utils';
import { qk } from '@/lib/query/keys';
import { ProductConfigurator } from './product-configurator';

/** Configurator in a bottom sheet (phones) / modal (desktop). */
export function ConfiguratorDialog({
  slug,
  open,
  onClose,
  edit,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  edit?: { key: string; initial: CartItemInput };
}) {
  const t = useTranslations('configurator');
  const tCommon = useTranslations('common');
  const localize = useLocalize();
  const product = useQuery({
    queryKey: qk.product(slug),
    queryFn: () => catalogApi.product(slug),
    enabled: open,
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={product.data ? localize(product.data.name) : t('title')}
      hideTitle
    >
      {product.isPending ? (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }} aria-busy>
          <Skeleton height={280} radius="var(--radius-xl)" />
          <Skeleton width="60%" height={28} />
          <Skeleton height={44} radius="var(--radius-pill)" />
          <Skeleton height={44} radius="var(--radius-pill)" />
        </div>
      ) : product.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void product.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : (
        <ProductConfigurator product={product.data} edit={edit} onDone={onClose} />
      )}
    </Dialog>
  );
}
