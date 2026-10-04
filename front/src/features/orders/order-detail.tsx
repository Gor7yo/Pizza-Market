'use client';
'use no memo';

import { isFinalStatus, type OrderDetailDto } from '@market/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/common/product-image';
import { Button } from '@/components/ui/button';
import { Badge, Price } from '@/components/ui/controls';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { ordersApi, reviewsApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';
import { useStores } from '@/stores/root-store';
import { OrderTimeline } from './order-timeline';
import styles from './orders.module.css';
import { PAYMENT_TONE, STATUS_TONE } from './status';

/** Live order page. Polls while the order is active (WebSockets can replace polling later). */
export const OrderDetail = observer(function OrderDetail({
  id,
  placed,
}: {
  id: string;
  placed: boolean;
}) {
  const t = useTranslations('orders');
  const tStatus = useTranslations('orderStatus');
  const tPayment = useTranslations('paymentStatus');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const money = useMoney();
  const localize = useLocalize();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { cart, ui } = useStores();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<{ id: string; name: string } | null>(null);

  const order = useQuery({
    queryKey: qk.order(id),
    queryFn: () => ordersApi.get(id),
    refetchInterval: (q) => (q.state.data && !isFinalStatus(q.state.data.status) ? 15_000 : false),
    refetchOnWindowFocus: true,
  });

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.order(id), data);
      void queryClient.invalidateQueries({ queryKey: ['orders', 'list'] });
      setConfirmCancel(false);
      toast.success(t('cancelled'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const repeat = (o: OrderDetailDto) => {
    cart.addMany(o.items.filter((i) => i.productId).map((i) => i.configuration));
    toast.success(t('repeated'));
    ui.openCart();
  };

  if (order.isPending) {
    return (
      <div className={styles.layout} aria-busy>
        <Skeleton height={360} radius="var(--radius-lg)" />
        <Skeleton height={280} radius="var(--radius-lg)" />
      </div>
    );
  }
  if (order.isError) {
    return (
      <ErrorState
        title={t('loadError')}
        action={<Button onClick={() => void order.refetch()}>{tCommon('retry')}</Button>}
      />
    );
  }

  const o = order.data;
  const reviewable = new Set(o.reviewableProductIds);

  return (
    <>
      {placed ? (
        <div className={styles.placed} role="status">
          <CheckCircle2 size={32} aria-hidden />
          <div>
            <strong>{t('placedTitle')}</strong>
            <p>{t('placedText')}</p>
          </div>
        </div>
      ) : null}

      <div
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}
      >
        <h1 className={styles.title}>{t('number', { number: o.number })}</h1>
        <Badge tone={STATUS_TONE[o.status]}>{tStatus(o.status)}</Badge>
      </div>
      <p className={styles.muted}>
        {format.dateTime(new Date(o.createdAt), { dateStyle: 'long', timeStyle: 'short' })}
      </p>

      <div className={styles.layout}>
        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <section className={styles.panel} aria-labelledby="tracking-title">
            <h2 id="tracking-title" className={styles.panelTitle}>
              {t('tracking')}
            </h2>
            <OrderTimeline status={o.status} fulfillment={o.fulfillment} history={o.history} />
          </section>

          <section className={styles.panel} aria-labelledby="items-title">
            <h2 id="items-title" className={styles.panelTitle}>
              {t('itemsTitle')}
            </h2>
            <ul className={styles.items}>
              {o.items.map((item) => {
                const name = localize(item.name);
                const details = [
                  item.sizeCm ? `${item.sizeCm} cm` : null,
                  item.crustName ? localize(item.crustName) : null,
                  ...item.extraIngredients.map((e) => `+ ${localize(e.name)}`),
                  ...item.removedIngredients.map((r) => `− ${localize(r.name)}`),
                ].filter(Boolean);
                return (
                  <li key={item.id} className={styles.item}>
                    <div className={styles.thumb}>
                      <ProductImage
                        src={item.imageUrl}
                        alt=""
                        seed={item.productSlug ?? item.id}
                        sizes="56px"
                      />
                    </div>
                    <div>
                      <strong>
                        {name} × {item.quantity}
                      </strong>
                      {details.length ? <p className={styles.muted}>{details.join(', ')}</p> : null}
                      {item.productId && reviewable.has(item.productId) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReviewProduct({ id: item.productId!, name })}
                        >
                          <Star size={14} aria-hidden /> {t('review')}
                        </Button>
                      ) : null}
                    </div>
                    <Price amount={item.lineTotal} showApprox={false} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className={styles.panel} aria-label={t('summary')}>
          <div className={styles.row}>
            <span className={styles.muted}>{t('subtotal')}</span>
            <span>{money.format(o.subtotal)}</span>
          </div>
          {o.discount > 0 ? (
            <div className={styles.row}>
              <span className={styles.muted}>
                {t('discount')} {o.promoCode ? `(${o.promoCode})` : ''}
              </span>
              <span>−{money.format(o.discount)}</span>
            </div>
          ) : null}
          <div className={styles.row}>
            <span className={styles.muted}>{t('delivery')}</span>
            <span>{o.deliveryFee === 0 ? t('free') : money.format(o.deliveryFee)}</span>
          </div>
          <div className={`${styles.row} ${styles.total}`}>
            <span>{t('total')}</span>
            <Price amount={o.total} />
          </div>
          {o.payment ? (
            <div className={styles.row}>
              <span className={styles.muted}>{t(`paymentMethod.${o.payment.method}`)}</span>
              <Badge tone={PAYMENT_TONE[o.payment.status]}>{tPayment(o.payment.status)}</Badge>
            </div>
          ) : null}
          {o.payment?.method === 'CARD' &&
          (o.payment.status === 'PENDING' || o.payment.status === 'FAILED') &&
          o.status === 'PENDING' ? (
            <Button href={`/checkout/pay/${o.id}`} variant="primary" block>
              {t('payNow')}
            </Button>
          ) : null}
          <div>
            <p className={styles.muted}>
              {o.fulfillment === 'DELIVERY' ? t('deliveryTo') : t('pickupFrom')}
            </p>
            {o.address ? (
              <p>
                {[
                  o.address.city,
                  o.address.street,
                  o.address.apartment && t('apt', { value: o.address.apartment }),
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            ) : null}
            <p className={styles.muted}>
              {o.contactName} · {o.contactPhone}
            </p>
          </div>
          <div className={styles.actions}>
            <Button onClick={() => repeat(o)}>
              <RotateCcw size={16} aria-hidden /> {t('repeat')}
            </Button>
            {o.canCancel ? (
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={t('cancelTitle', { number: o.number })}
        description={t('cancelText')}
        confirmLabel={t('cancelConfirm')}
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      />
      {reviewProduct ? (
        <QuickReviewDialog
          product={reviewProduct}
          onClose={() => setReviewProduct(null)}
          onDone={() => {
            setReviewProduct(null);
            void order.refetch();
          }}
        />
      ) : null}
    </>
  );
});

function QuickReviewDialog({
  product,
  onClose,
  onDone,
}: {
  product: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('reviews');
  const errorMessage = useErrorMessage();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      reviewsApi.create({ productId: product.id, rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast.success(t('sent'));
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('writeFor', { name: product.name })}
      footer={
        <Button variant="primary" block loading={submit.isPending} onClick={() => submit.mutate()}>
          {t('submit')}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div
          role="radiogroup"
          aria-label={t('rating')}
          style={{ display: 'flex', gap: 'var(--space-1)' }}
        >
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={rating === v}
              aria-label={t('stars', { count: v })}
              onClick={() => setRating(v)}
              style={{
                border: 'none',
                background: 'transparent',
                color: v <= rating ? 'var(--color-rating)' : 'var(--color-border-strong)',
                padding: 4,
              }}
            >
              <Star size={30} fill="currentColor" aria-hidden />
            </button>
          ))}
        </div>
        <label htmlFor="quick-review" className="visually-hidden">
          {t('comment')}
        </label>
        <textarea
          id="quick-review"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('comment')}
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {t('moderationNote')}
        </p>
      </div>
    </Dialog>
  );
}
