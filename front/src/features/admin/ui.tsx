'use client';

import { type Currency, formatMinorToMajor, LOCALES, parseMajorToMinor } from '@market/shared';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useMoney } from '@/lib/money';
import styles from './admin.module.css';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.pageTitle}>{title}</h1>
      {actions ? (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>{actions}</div>
      ) : null}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
      {children}
    </section>
  );
}

/**
 * Edits an integer amount of minor units through a major-unit text field ("10.50"),
 * using exact string<->integer conversion (no floats).
 */
export function MoneyInput({
  value,
  onChange,
  label,
  error,
  allowNull,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  error?: string;
  allowNull?: boolean;
}) {
  const { currency } = useMoney();
  const tAdmin = useTranslations('admin');
  const [text, setText] = useState(
    value === null ? '' : formatMinorToMajor(value, currency as Currency),
  );
  const [localError, setLocalError] = useState<string | undefined>();

  return (
    <Field label={`${label}, ${currency}`} error={localError ?? error} optional={allowNull}>
      {(a11y) => (
        <Input
          {...a11y}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (next.trim() === '') {
              setLocalError(allowNull ? undefined : 'required');
              if (allowNull) onChange(null);
              return;
            }
            try {
              const minor = parseMajorToMinor(next, currency as Currency);
              if (minor < 0) throw new Error('negative');
              setLocalError(undefined);
              onChange(minor);
            } catch {
              setLocalError(tAdmin('invalidAmount'));
            }
          }}
        />
      )}
    </Field>
  );
}

const LOCALE_NAMES = { ru: 'RU', en: 'EN', hy: 'HY' } as const;

/** One input per supported locale for translatable catalog texts. */
export function LocalizedInputs({
  label,
  value,
  onChange,
  multiline,
  error,
}: {
  label: string;
  value: Partial<Record<(typeof LOCALES)[number], string>> | undefined;
  onChange: (value: Partial<Record<(typeof LOCALES)[number], string>>) => void;
  multiline?: boolean;
  error?: string;
}) {
  return (
    <fieldset
      style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-2)' }}
    >
      <legend
        style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}
      >
        {label}
      </legend>
      <div className={styles.cols}>
        {LOCALES.map((locale, index) => (
          <Field key={locale} label={LOCALE_NAMES[locale]} error={index === 0 ? error : undefined}>
            {(a11y) =>
              multiline ? (
                <Textarea
                  {...a11y}
                  rows={3}
                  lang={locale}
                  value={value?.[locale] ?? ''}
                  onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
                />
              ) : (
                <Input
                  {...a11y}
                  lang={locale}
                  value={value?.[locale] ?? ''}
                  onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
                />
              )
            }
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

export function TableSkeleton() {
  return (
    <div
      className={styles.tableWrap}
      aria-busy
      style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            height: 20,
            borderRadius: 6,
            background: 'var(--color-surface-muted)',
          }}
        />
      ))}
    </div>
  );
}
