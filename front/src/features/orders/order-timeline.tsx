'use client';

import {
  type FulfillmentType,
  getTrackingSteps,
  type OrderStatus,
  type OrderStatusHistoryDto,
} from '@market/shared';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import styles from './orders.module.css';

/** Visual tracking: ✓ done, ● current (pulsing), ○ upcoming. Times come from the status history. */
export function OrderTimeline({
  status,
  fulfillment,
  history,
}: {
  status: OrderStatus;
  fulfillment: FulfillmentType;
  history: OrderStatusHistoryDto[];
}) {
  const t = useTranslations('orderStatus');
  const tOrders = useTranslations('orders');
  const format = useFormatter();

  if (status === 'CANCELLED') {
    return (
      <p className={styles.cancelled} role="status">
        {tOrders('cancelledNotice')}
      </p>
    );
  }

  const steps = getTrackingSteps(fulfillment);
  const currentIndex = steps.indexOf(status);
  const reachedAt = new Map(history.map((h) => [h.toStatus, h.createdAt]));
  const progress = steps.length > 1 ? currentIndex / (steps.length - 1) : 1;

  return (
    <div className={styles.timeline}>
      <div className={styles.track} aria-hidden>
        <motion.div
          className={styles.trackFill}
          initial={{ height: 0 }}
          animate={{ height: `${progress * 100}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
      <ol className={styles.steps} aria-label={tOrders('tracking')}>
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending';
          const at = reachedAt.get(step);
          const label = fulfillment === 'PICKUP' && step === 'DELIVERED' ? t('PICKED_UP') : t(step);
          return (
            <li
              key={step}
              className={cn(styles.stepRow, styles[state])}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span
                className={cn(
                  styles.dot,
                  state === 'current' && status !== 'DELIVERED' && styles.pulse,
                )}
                aria-hidden
              >
                {state !== 'pending' ? <Check size={16} strokeWidth={3} /> : null}
              </span>
              <span>
                <span className={styles.stepLabel}>{label}</span>
                <span className="visually-hidden"> — {tOrders(`stepState.${state}`)}</span>
                {at && state !== 'pending' ? (
                  <time className={styles.stepTime} dateTime={at}>
                    {format.dateTime(new Date(at), {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </time>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
