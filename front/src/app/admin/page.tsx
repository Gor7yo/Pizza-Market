'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, SegmentedControl } from '@/components/ui/controls';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import styles from '@/features/admin/admin.module.css';
import { SalesChart } from '@/features/admin/sales-chart';
import { Card, PageHeader } from '@/features/admin/ui';
import { STATUS_TONE } from '@/features/orders/status';
import { adminApi } from '@/lib/api/endpoints';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

const PERIODS = ['7', '30', '90'] as const;

export default function DashboardPage() {
  const t = useTranslations('admin.dashboard');
  const tStatus = useTranslations('orderStatus');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const money = useMoney();
  const localize = useLocalize();
  const [days, setDays] = useState<(typeof PERIODS)[number]>('30');
  const stats = useQuery({
    queryKey: qk.admin.dashboard(Number(days)),
    queryFn: () => adminApi.dashboard(Number(days)),
  });

  const header = (
    <PageHeader
      title={t('title')}
      actions={
        <div style={{ minWidth: 260 }}>
          <SegmentedControl
            name="period"
            legend={t('period')}
            value={days}
            onChange={setDays}
            options={PERIODS.map((p) => ({ value: p, label: t('days', { count: Number(p) }) }))}
          />
        </div>
      }
    />
  );

  if (stats.isPending) {
    return (
      <>
        {header}
        <div className={styles.stats}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={96} radius="var(--radius-md)" />
          ))}
        </div>
        <Skeleton height={280} radius="var(--radius-md)" />
      </>
    );
  }
  if (stats.isError) {
    return (
      <>
        {header}
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void stats.refetch()}>{tCommon('retry')}</Button>}
        />
      </>
    );
  }

  const s = stats.data;
  const tiles = [
    { label: t('revenue'), value: money.format(s.revenue) },
    { label: t('orders'), value: format.number(s.orders) },
    { label: t('aov'), value: money.format(s.averageOrderValue) },
    { label: t('newCustomers'), value: format.number(s.newCustomers) },
  ];
  const maxQty = Math.max(1, ...s.popularProducts.map((p) => p.quantity));

  return (
    <>
      {header}
      <div className={styles.stats}>
        {tiles.map((tile) => (
          <div key={tile.label} className={`${styles.card} ${styles.stat}`}>
            <span className={styles.statLabel}>{tile.label}</span>
            <span className={styles.statValue}>{tile.value}</span>
          </div>
        ))}
      </div>

      {s.orders === 0 && s.cancelledOrders === 0 ? (
        <Card>
          <EmptyState icon={BarChart3} title={t('noDataTitle')} text={t('noDataText')} />
        </Card>
      ) : (
        <div className={styles.dashGrid}>
          <Card title={t('salesTrend')}>
            <SalesChart data={s.salesByDay} />
          </Card>
          <Card title={t('popular')}>
            {s.popularProducts.length === 0 ? (
              <p className={styles.muted}>{t('noData')}</p>
            ) : (
              <ul className={styles.hbars}>
                {s.popularProducts.map((p) => (
                  <li key={p.productId} className={styles.hbarRow}>
                    <span className={styles.hbarLabel}>
                      <span>{localize(p.name)}</span>
                      <span className={styles.muted}>
                        {t('units', { count: p.quantity })} · {money.format(p.revenue)}
                      </span>
                    </span>
                    <span className={styles.hbarTrack} aria-hidden>
                      <span
                        className={styles.hbarFill}
                        style={{ display: 'block', width: `${(p.quantity / maxQty) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('recentOrders')}>
            <div className={styles.tableWrap} style={{ boxShadow: 'none' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('customer')}</th>
                    <th scope="col">{t('status')}</th>
                    <th scope="col" className={styles.num}>
                      {t('total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}`}>#{o.number}</Link>
                      </td>
                      <td>{o.customer?.name ?? '—'}</td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]}>{tStatus(o.status)}</Badge>
                      </td>
                      <td className={styles.num}>{money.format(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={t('byStatus')}>
            <ul className={styles.hbars}>
              {s.ordersByStatus.map((row) => (
                <li key={row.status} className={styles.hbarLabel}>
                  <Badge tone={STATUS_TONE[row.status]}>{tStatus(row.status)}</Badge>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
            <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
              {t('cancelled', { count: s.cancelledOrders })}
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
