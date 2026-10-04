'use client';

import {
  type StoreSettingsDto,
  type StoreSettingsInput,
  storeSettingsSchema,
} from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { Card, MoneyInput, PageHeader } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

function toInput(s: StoreSettingsDto): StoreSettingsInput {
  return {
    isAcceptingOrders: s.isAcceptingOrders,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    minOrderAmount: s.minOrderAmount,
    pickupAddress: s.pickupAddress,
    supportPhone: s.supportPhone,
    exchangeRates: {
      USD: s.exchangeRates.rates.USD ?? null,
      RUB: s.exchangeRates.rates.RUB ?? null,
      AMD: s.exchangeRates.rates.AMD ?? null,
    },
  };
}

function SettingsForm({ settings }: { settings: StoreSettingsDto }) {
  const t = useTranslations('admin.settings');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<StoreSettingsInput>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: toInput(settings),
  });
  const errors = form.formState.errors;
  const others = (['AMD', 'USD', 'RUB'] as const).filter((c) => c !== settings.currency);

  const save = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: (next) => {
      queryClient.setQueryData(qk.admin.settings, next);
      queryClient.setQueryData(qk.settings, next);
      form.reset(toInput(next));
      toast.success(t('saved'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className={styles.form}>
      <Card title={t('orders')}>
        <div className={styles.form}>
          <Checkbox label={t('acceptingOrders')} {...form.register('isAcceptingOrders')} />
          <div className={styles.cols}>
            <Controller
              control={form.control}
              name="deliveryFee"
              render={({ field }) => (
                <MoneyInput
                  label={t('deliveryFee')}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="freeDeliveryThreshold"
              render={({ field }) => (
                <MoneyInput
                  label={t('freeDelivery')}
                  allowNull
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="minOrderAmount"
              render={({ field }) => (
                <MoneyInput
                  label={t('minOrder')}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                />
              )}
            />
          </div>
        </div>
      </Card>
      <Card title={t('contacts')}>
        <div className={`${styles.cols} ${styles.cols2}`}>
          <Field label={t('pickupAddress')} error={errors.pickupAddress?.message}>
            {(a11y) => <Input {...a11y} {...form.register('pickupAddress')} />}
          </Field>
          <Field label={t('supportPhone')} error={errors.supportPhone?.message}>
            {(a11y) => <Input {...a11y} type="tel" {...form.register('supportPhone')} />}
          </Field>
        </div>
      </Card>
      <Card title={t('rates')}>
        <p className={styles.muted} style={{ marginBottom: 'var(--space-3)' }}>
          {t('ratesHint', { base: settings.currency })}
          {settings.exchangeRates.updatedAt
            ? ` ${t('ratesUpdated', { date: format.dateTime(new Date(settings.exchangeRates.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}`
            : ''}
        </p>
        <div className={`${styles.cols} ${styles.cols2}`}>
          {others.map((c) => (
            <Controller
              key={c}
              control={form.control}
              name={`exchangeRates.${c}`}
              render={({ field, fieldState }) => (
                <Field
                  label={`1 ${settings.currency} = ? ${c}`}
                  optional
                  error={fieldState.error?.message}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      inputMode="decimal"
                      placeholder="0.0026"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value.trim() === '' ? null : e.target.value.replace(',', '.'),
                        )
                      }
                    />
                  )}
                </Field>
              )}
            />
          ))}
        </div>
      </Card>
      <div className={styles.stickyActions}>
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={!form.formState.isDirty}
        >
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

export default function AdminSettingsPage() {
  const t = useTranslations('admin.settings');
  const tCommon = useTranslations('common');
  const settings = useQuery({ queryKey: qk.admin.settings, queryFn: adminApi.settings });
  return (
    <>
      <PageHeader title={t('title')} />
      {settings.isPending ? (
        <Skeleton height={420} radius="var(--radius-md)" />
      ) : settings.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void settings.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </>
  );
}
