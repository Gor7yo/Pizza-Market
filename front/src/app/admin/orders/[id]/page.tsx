'use client';

import type { OrderStatus } from '@market/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { Card, PageHeader } from '@/features/admin/ui';
import { OrderTimeline } from '@/features/orders/order-timeline';
import { PAYMENT_TONE, STATUS_TONE } from '@/features/orders/status';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin.orders');
  const tStatus = useTranslations('orderStatus');
  const tPayment = useTranslations('paymentStatus');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const money = useMoney();
  const localize = useLocalize();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);

  const order = useQuery({ queryKey: qk.admin.order(id), queryFn: () => adminApi.order(id) });
  const update = useMutation({
    mutationFn: (status: OrderStatus) =>
      adminApi.updateOrderStatus(id, status, note.trim() || undefined),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.admin.order(id), data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setNote('');
      setConfirm(null);
      toast.success(t('statusUpdated'));
    },
    onError: (err) => {
      setConfirm(null);
      toast.error(errorMessage(err));
    },
  });

  if (order.isPending) return <Skeleton height={480} radius="var(--radius-md)" />;
  if (order.isError) {
    return (
      <ErrorState
        title={t('loadError')}
        action={<Button onClick={() => void order.refetch()}>{tCommon('retry')}</Button>}
      />
    );
  }
  const o = order.data;

  return (
    <div className={styles.form}>
      <PageHeader
        title={t('orderTitle', { number: o.number })}
        actions={<Badge tone={STATUS_TONE[o.status]}>{tStatus(o.status)}</Badge>}
      />
      <div className={styles.formGrid}>
        <div className={styles.form}>
          <Card title={t('changeStatus')}>
            {o.allowedTransitions.length === 0 ? (
              <p className={styles.muted}>{t('finalStatus')}</p>
            ) : (
              <div className={styles.form}>
                <Field label={t('note')} optional>
                  {(a11y) => (
                    <Textarea
                      {...a11y}
                      rows={2}
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                </Field>
                <div className={styles.toolbar} style={{ marginBottom: 0 }}>
                  {o.allowedTransitions.map((s) => (
                    <Button
                      key={s}
                      variant={s === 'CANCELLED' ? 'danger' : 'primary'}
                      loading={update.isPending && update.variables === s}
                      disabled={update.isPending}
                      onClick={() => (s === 'CANCELLED' ? setConfirm(s) : update.mutate(s))}
                    >
                      {t('moveTo', { status: tStatus(s) })}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card title={t('items')}>
            <div className={styles.tableWrap} style={{ boxShadow: 'none' }}>
              <table className={styles.table}>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>
                          {localize(i.name)} × {i.quantity}
                        </strong>
                        <br />
                        <span className={styles.muted}>
                          {[
                            i.sizeCm ? `${i.sizeCm} cm` : null,
                            i.crustName ? localize(i.crustName) : null,
                            ...i.extraIngredients.map((e) => `+ ${localize(e.name)}`),
                            ...i.removedIngredients.map((r) => `− ${localize(r.name)}`),
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </td>
                      <td className={styles.num}>{money.format(i.unitPrice)}</td>
                      <td className={styles.num}>{money.format(i.lineTotal)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>{t('subtotal')}</td>
                    <td />
                    <td className={styles.num}>{money.format(o.subtotal)}</td>
                  </tr>
                  {o.discount > 0 ? (
                    <tr>
                      <td>
                        {t('discount')} {o.promoCode ? `(${o.promoCode})` : ''}
                      </td>
                      <td />
                      <td className={styles.num}>−{money.format(o.discount)}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td>{t('deliveryFee')}</td>
                    <td />
                    <td className={styles.num}>{money.format(o.deliveryFee)}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>{t('total')}</strong>
                    </td>
                    <td />
                    <td className={styles.num}>
                      <strong>{money.format(o.total)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={t('history')}>
            <ul className={styles.hbars}>
              {o.history.map((h) => (
                <li key={h.id} className={styles.hbarLabel}>
                  <span>
                    {h.fromStatus ? `${tStatus(h.fromStatus)} → ` : ''}
                    <strong>{tStatus(h.toStatus)}</strong>
                    {h.note ? <span className={styles.muted}> — {h.note}</span> : null}
                  </span>
                  <span className={styles.muted}>
                    {format.dateTime(new Date(h.createdAt), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className={styles.form}>
          <Card title={t('tracking')}>
            <OrderTimeline status={o.status} fulfillment={o.fulfillment} history={o.history} />
          </Card>
          <Card title={t('customer')}>
            <p>
              <strong>{o.contactName}</strong>
            </p>
            <p>
              <a href={`tel:${o.contactPhone}`}>{o.contactPhone}</a>
            </p>
            {o.customer ? <p className={styles.muted}>{o.customer.email}</p> : null}
            <p style={{ marginTop: 'var(--space-3)' }}>{t(`fulfillmentType.${o.fulfillment}`)}</p>
            {o.address ? (
              <p className={styles.muted}>
                {[
                  o.address.city,
                  o.address.street,
                  o.address.apartment && `${t('apartment')} ${o.address.apartment}`,
                  o.address.entrance && `${t('entrance')} ${o.address.entrance}`,
                  o.address.floor && `${t('floor')} ${o.address.floor}`,
                  o.address.intercom && `${t('intercom')} ${o.address.intercom}`,
                ]
                  .filter(Boolean)
                  .join(', ')}
                {o.address.instructions ? (
                  <>
                    <br />
                    {o.address.instructions}
                  </>
                ) : null}
              </p>
            ) : null}
            {o.comment ? <p style={{ marginTop: 'var(--space-3)' }}>💬 {o.comment}</p> : null}
          </Card>
          {o.payment ? (
            <Card title={t('payment')}>
              <p>
                {t(`method.${o.payment.method}`)} ·{' '}
                <Badge tone={PAYMENT_TONE[o.payment.status]}>{tPayment(o.payment.status)}</Badge>
              </p>
              <p className={styles.muted}>{o.payment.provider}</p>
              {o.payment.failureReason ? (
                <p className={styles.muted}>{o.payment.failureReason}</p>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={t('cancelTitle', { number: o.number })}
        description={o.payment?.status === 'SUCCEEDED' ? t('cancelRefund') : undefined}
        confirmLabel={t('cancelConfirm')}
        danger
        loading={update.isPending}
        onConfirm={() => confirm && update.mutate(confirm)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
