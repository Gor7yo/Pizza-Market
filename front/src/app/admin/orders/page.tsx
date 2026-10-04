'use client';

import { ORDER_STATUSES, type OrderStatus } from '@market/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Pagination } from '@/components/ui/controls';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { PageHeader, TableSkeleton } from '@/features/admin/ui';
import { PAYMENT_TONE, STATUS_TONE } from '@/features/orders/status';
import { adminApi } from '@/lib/api/endpoints';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

function toIsoStart(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}
function toIsoEnd(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
  const tStatus = useTranslations('orderStatus');
  const tPayment = useTranslations('paymentStatus');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const money = useMoney();
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query = {
    status: status || undefined,
    q: q || undefined,
    from: toIsoStart(from),
    to: toIsoEnd(to),
    page,
    pageSize: 25,
  };
  const orders = useQuery({
    queryKey: qk.admin.orders(query),
    queryFn: () => adminApi.orders(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader title={t('title')} />
      <div className={styles.toolbar}>
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label={t('status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label={t('from')}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          aria-label={t('to')}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {orders.isPending ? (
        <TableSkeleton />
      ) : orders.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void orders.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : orders.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('date')}</th>
                <th scope="col">{t('customer')}</th>
                <th scope="col">{t('fulfillment')}</th>
                <th scope="col">{t('status')}</th>
                <th scope="col">{t('payment')}</th>
                <th scope="col" className={styles.num}>
                  {t('total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>
                      <strong>#{o.number}</strong>
                    </Link>
                  </td>
                  <td className={styles.muted}>
                    {format.dateTime(new Date(o.createdAt), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    {o.customer?.name ?? '—'}
                    <br />
                    <span className={styles.muted}>{o.contactPhone}</span>
                  </td>
                  <td>{t(`fulfillmentType.${o.fulfillment}`)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[o.status]}>{tStatus(o.status)}</Badge>
                  </td>
                  <td>
                    {o.paymentStatus ? (
                      <Badge tone={PAYMENT_TONE[o.paymentStatus]}>
                        {tPayment(o.paymentStatus)}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.num}>{money.format(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={orders.data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}
