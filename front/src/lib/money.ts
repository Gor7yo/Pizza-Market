'use client';
'use no memo';

import { convertMoney, type Currency, formatMoney, type StoreSettingsDto } from '@market/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { catalogApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';
import { useStores } from '@/stores/root-store';

export function useStoreSettings(): StoreSettingsDto | undefined {
  return useQuery({ queryKey: qk.settings, queryFn: catalogApi.settings, staleTime: 5 * 60_000 })
    .data;
}

/**
 * Formats integer minor units in the store currency, plus an optional approximate
 * value in the visitor's display currency (manual admin rates, clearly marked "≈").
 */
export function useMoney() {
  const locale = useLocale();
  const settings = useStoreSettings();
  const { ui } = useStores();
  const currency: Currency = settings?.currency ?? 'AMD';

  const format = (amount: number) => formatMoney(amount, currency, locale);

  const approx = (amount: number): string | null => {
    const target = ui.displayCurrency;
    if (!settings || !target || target === currency) return null;
    const converted = convertMoney(amount, target, settings.exchangeRates);
    return converted === null ? null : `≈ ${formatMoney(converted, target, locale)}`;
  };

  return { format, approx, currency };
}
