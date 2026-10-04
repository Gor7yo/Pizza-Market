'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { ProductForm } from '@/features/admin/product-form';
import { adminApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin.products');
  const tCommon = useTranslations('common');
  const product = useQuery({ queryKey: qk.admin.product(id), queryFn: () => adminApi.product(id) });

  if (product.isPending) return <Skeleton height={520} radius="var(--radius-md)" />;
  if (product.isError) {
    return (
      <ErrorState
        title={t('loadError')}
        action={<Button onClick={() => void product.refetch()}>{tCommon('retry')}</Button>}
      />
    );
  }
  // key: reinitialize the form when the product is archived/restored
  return (
    <ProductForm key={`${product.data.id}:${product.data.updatedAt}`} product={product.data} />
  );
}
