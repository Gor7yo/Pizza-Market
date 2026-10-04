import { Skeleton } from '@/components/ui/feedback';

export default function ProductLoading() {
  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-6)',
        display: 'grid',
        gap: 'var(--space-6)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      }}
      aria-busy
    >
      <Skeleton height={420} radius="var(--radius-xl)" />
      <div style={{ display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
        <Skeleton width="60%" height={36} />
        <Skeleton height={60} />
        <Skeleton height={48} radius="var(--radius-pill)" />
        <Skeleton height={48} radius="var(--radius-pill)" />
        <Skeleton height={120} />
      </div>
    </div>
  );
}
