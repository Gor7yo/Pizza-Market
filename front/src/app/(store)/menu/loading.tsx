import { Skeleton } from '@/components/ui/feedback';
import { ProductGridSkeleton } from '@/features/catalog/product-card';

export default function MenuLoading() {
  return (
    <div
      className="container"
      style={{ paddingTop: 'var(--space-6)', display: 'grid', gap: 'var(--space-5)' }}
      aria-busy
    >
      <Skeleton width={220} height={40} />
      <Skeleton height={44} radius="var(--radius-pill)" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
