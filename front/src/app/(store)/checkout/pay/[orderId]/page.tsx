'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/controls';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import styles from '@/features/checkout/checkout.module.css';
import { ordersApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

/**
 * Hosted payment page of the MOCK provider. It stands in for a real acquiring page;
 * the outcome is reported to the API, which applies it server-side.
 */
export default function MockPaymentPage() {
  const t = useTranslations('payment');
  const tCommon = useTranslations('common');
  const errorMessage = useErrorMessage();
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: qk.order(orderId), queryFn: () => ordersApi.get(orderId) });

  const confirm = useMutation({
    mutationFn: (outcome: 'success' | 'failure') => ordersApi.mockConfirm(orderId, outcome),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: qk.order(orderId) });
      if (payment.status === 'SUCCEEDED') router.replace(`/orders/${orderId}?placed=1`);
    },
  });
  const retry = useMutation({
    mutationFn: () => ordersApi.retryPayment(orderId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.order(orderId) }),
  });

  if (order.isPending) {
    return (
      <div className="container">
        <div className={styles.payCard}>
          <Skeleton height={180} radius="var(--radius-lg)" />
          <Skeleton height={54} radius="var(--radius-pill)" />
        </div>
      </div>
    );
  }
  if (order.isError) {
    return (
      <div className="container">
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void order.refetch()}>{tCommon('retry')}</Button>}
        />
      </div>
    );
  }

  const payment = order.data.payment;
  const failed = payment?.status === 'FAILED';
  const awaiting = payment?.status === 'PENDING';

  return (
    <div className="container">
      <section className={styles.payCard} aria-labelledby="pay-title">
        <h1 id="pay-title" className={styles.title} style={{ fontSize: 'var(--text-2xl)' }}>
          {t('title', { number: order.data.number })}
        </h1>
        <p className={styles.notice}>{t('mockNotice')}</p>
        <div className={styles.fakeCard} aria-hidden>
          <CreditCard size={28} />
          <span>4242 4242 4242 4242</span>
          <span>12/30 · CVC 123</span>
        </div>
        <div className={styles.summaryItem}>
          <span>{t('amount')}</span>
          <Price amount={order.data.total} />
        </div>
        {confirm.isError ? <p role="alert">{errorMessage(confirm.error)}</p> : null}
        {failed ? (
          <>
            <p role="alert" className={styles.optionText}>
              {t('failed')}
            </p>
            <Button
              variant="primary"
              size="lg"
              block
              loading={retry.isPending}
              onClick={() => retry.mutate()}
            >
              {t('retry')}
            </Button>
          </>
        ) : awaiting ? (
          <>
            <Button
              variant="primary"
              size="lg"
              block
              loading={confirm.isPending}
              onClick={() => confirm.mutate('success')}
            >
              {t('pay')}
            </Button>
            <Button
              variant="ghost"
              block
              disabled={confirm.isPending}
              onClick={() => confirm.mutate('failure')}
            >
              {t('simulateFailure')}
            </Button>
          </>
        ) : (
          <Button href={`/orders/${orderId}`} variant="primary" block>
            {t('toOrder')}
          </Button>
        )}
      </section>
    </div>
  );
}
