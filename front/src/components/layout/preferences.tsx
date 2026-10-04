'use client';
'use no memo';

import { type Currency, CURRENCIES, isCurrency, LOCALE_LABELS, LOCALES } from '@market/shared';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocaleAction } from '@/i18n/actions';
import { useStoreSettings } from '@/lib/money';
import { useStores } from '@/stores/root-store';
import styles from './layout.module.css';

export function LocaleSwitcher({ className = styles.prefSelect }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      className={className}
      aria-label={t('language')}
      value={locale}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        });
      }}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}

/** Approximate-price currency (display only; orders are charged in the store currency). */
export const CurrencySwitcher = observer(function CurrencySwitcher({
  className = styles.prefSelect,
}: {
  className?: string;
}) {
  const t = useTranslations('common');
  const { ui } = useStores();
  const settings = useStoreSettings();
  const base = settings?.currency ?? 'AMD';
  const available: Currency[] = CURRENCIES.filter(
    (c) => c === base || settings?.exchangeRates.rates[c],
  );

  if (available.length <= 1) return null;
  return (
    <select
      className={className}
      aria-label={t('currency')}
      value={ui.displayCurrency ?? base}
      onChange={(e) => {
        const value = e.target.value;
        ui.setDisplayCurrency(isCurrency(value) && value !== base ? value : null);
      }}
    >
      {available.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
});
