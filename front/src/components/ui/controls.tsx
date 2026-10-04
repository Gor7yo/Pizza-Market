'use client';
'use no memo';

import { ChevronLeft, ChevronRight, Minus, Plus, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useMoney } from '@/lib/money';
import { Button } from './button';
import styles from './controls.module.css';

export type BadgeTone =
  'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn(styles.badge, tone !== 'neutral' && styles[`badge-${tone}`])}>
      {children}
    </span>
  );
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  const t = useTranslations('product');
  if (value === null) return null;
  return (
    <span
      className={styles.rating}
      aria-label={t('ratingLabel', { value: value.toFixed(1), count: count ?? 0 })}
    >
      <Star size={16} className={styles.star} fill="currentColor" aria-hidden />
      <span aria-hidden>{value.toFixed(1)}</span>
      {count !== undefined ? (
        <span className={styles.ratingCount} aria-hidden>
          ({count})
        </span>
      ) : null}
    </span>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const t = useTranslations('common');
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={t('decrease')}
      >
        <Minus size={16} aria-hidden />
      </button>
      <output className={styles.stepperValue} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={t('increase')}
      >
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Accessible radio group styled as a segmented control. */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.segmented}>
      <legend className="visually-hidden">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={styles.segment}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const t = useTranslations('common');
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label={t('pagination')}>
      <Button
        size="sm"
        iconOnly
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t('prevPage')}
      >
        <ChevronLeft size={18} aria-hidden />
      </Button>
      <span className={styles.pageInfo}>{t('pageOf', { page, total: totalPages })}</span>
      <Button
        size="sm"
        iconOnly
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t('nextPage')}
      >
        <ChevronRight size={18} aria-hidden />
      </Button>
    </nav>
  );
}

/** Price in the store currency with an optional "≈" hint in the display currency. */
export const Price = observer(function Price({
  amount,
  className,
  showApprox = true,
}: {
  amount: number;
  className?: string;
  showApprox?: boolean;
}) {
  const { format, approx } = useMoney();
  const hint = showApprox ? approx(amount) : null;
  return (
    <span className={cn(styles.price, className)}>
      {format(amount)}
      {hint ? <span className={styles.approx}>{hint}</span> : null}
    </span>
  );
});
