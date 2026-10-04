'use client';

import { REVIEW_STATUSES, type ReviewStatus } from '@market/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone, Pagination } from '@/components/ui/controls';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { qk } from '@/lib/query/keys';

const TONE: Record<ReviewStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export default function AdminReviewsPage() {
  const t = useTranslations('admin.reviews');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const localize = useLocalize();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const query = { status: status || undefined, page, pageSize: 20 };
  const reviews = useQuery({
    queryKey: qk.admin.reviews(query),
    queryFn: () => adminApi.reviews(query),
    placeholderData: keepPreviousData,
  });

  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'APPROVED' | 'REJECTED' }) =>
      adminApi.moderateReview(id, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      toast.success(t('moderated'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader title={t('title')} />
      <div className={styles.toolbar}>
        <Select
          aria-label={t('status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ReviewStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('all')}</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      {reviews.isPending ? (
        <TableSkeleton />
      ) : reviews.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void reviews.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : reviews.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('product')}</th>
                <th scope="col">{t('review')}</th>
                <th scope="col">{t('author')}</th>
                <th scope="col">{t('status')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {reviews.data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/product/${r.product.slug}`} target="_blank">
                      {localize(r.product.name)}
                    </Link>
                  </td>
                  <td style={{ maxWidth: 420 }}>
                    <span
                      aria-label={t('rating', { value: r.rating })}
                      style={{ display: 'inline-flex', gap: 2, color: 'var(--color-rating)' }}
                    >
                      {Array.from({ length: r.rating }, (_, i) => (
                        <Star key={i} size={14} fill="currentColor" aria-hidden />
                      ))}
                    </span>
                    {r.comment ? <p>{r.comment}</p> : null}
                  </td>
                  <td>
                    {r.authorName}
                    <br />
                    <span className={styles.muted}>
                      {r.user.email} ·{' '}
                      {format.dateTime(new Date(r.createdAt), { dateStyle: 'short' })}
                    </span>
                  </td>
                  <td>
                    <Badge tone={TONE[r.status]}>{t(`statuses.${r.status}`)}</Badge>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {r.status !== 'APPROVED' ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={moderate.isPending}
                          onClick={() => moderate.mutate({ id: r.id, next: 'APPROVED' })}
                        >
                          {t('approve')}
                        </Button>
                      ) : null}
                      {r.status !== 'REJECTED' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={moderate.isPending}
                          onClick={() => moderate.mutate({ id: r.id, next: 'REJECTED' })}
                        >
                          {t('reject')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={reviews.data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}
