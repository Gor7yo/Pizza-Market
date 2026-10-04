'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Pagination, Price } from '@/components/ui/controls';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import styles from '@/features/orders/orders.module.css';
import { STATUS_TONE } from '@/features/orders/status';
import { ordersApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';

export default function OrdersPage() {
  const t = useTranslations('orders');
  const tStatus = useTranslations('orderStatus');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const query = { page, pageSize: 10 };
  const orders = useQuery({ queryKey: qk.orders(query), queryFn: () => ordersApi.list(query) });

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>{t('title')}</h1>
      {orders.isPending ? (
        <div className={styles.list} aria-busy>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={92} radius="var(--radius-lg)" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void orders.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : orders.data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            <Button href="/menu" variant="primary">
              {t('toMenu')}
            </Button>
          }
        />
      ) : (
        <>
          <ul className={styles.list}>
            {orders.data.items.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className={styles.card}>
                  <span className={styles.cardTitle}>{t('number', { number: o.number })}</span>
                  <Badge tone={STATUS_TONE[o.status]}>{tStatus(o.status)}</Badge>
                  <span className={styles.muted}>
                    {format.dateTime(new Date(o.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}{' '}
                    · {t('items', { count: o.itemCount })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Price amount={o.total} showApprox={false} />
                    <ChevronRight size={18} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
