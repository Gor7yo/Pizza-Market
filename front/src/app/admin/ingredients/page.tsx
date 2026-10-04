'use client';

import {
  type AdminCrustDto,
  type AdminIngredientDto,
  type CrustInput,
  crustInputSchema,
  type IngredientInput,
  ingredientInputSchema,
} from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/feedback';
import { Checkbox, Field, Input } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { Card, LocalizedInputs, MoneyInput, PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

function IngredientDialog({
  item,
  onClose,
}: {
  item: AdminIngredientDto | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.ingredients');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<IngredientInput>({
    resolver: zodResolver(ingredientInputSchema),
    defaultValues: item
      ? {
          name: item.name,
          extraPrice: item.extraPrice,
          imageKey: item.imageKey,
          isAvailable: item.isAvailable,
        }
      : { name: {}, extraPrice: 0, imageKey: null, isAvailable: true },
  });
  const save = useMutation({
    mutationFn: (v: IngredientInput) =>
      item ? adminApi.updateIngredient(item.id, v) : adminApi.createIngredient(v),
    onSuccess: (list) => {
      queryClient.setQueryData(qk.admin.ingredients, list);
      toast.success(t('saved'));
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const submit = form.handleSubmit((v) => save.mutate(v));
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t('editIngredient') : t('createIngredient')}
      footer={
        <Button variant="primary" block loading={save.isPending} onClick={() => void submit()}>
          {t('save')}
        </Button>
      }
    >
      <form noValidate onSubmit={submit} className={styles.form}>
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <LocalizedInputs
              label={t('name')}
              value={field.value}
              onChange={field.onChange}
              error={form.formState.errors.name?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="extraPrice"
          render={({ field }) => (
            <MoneyInput
              label={t('extraPrice')}
              value={field.value}
              onChange={(v) => field.onChange(v ?? 0)}
            />
          )}
        />
        <Checkbox label={t('isAvailable')} {...form.register('isAvailable')} />
      </form>
    </Dialog>
  );
}

function CrustDialog({ item, onClose }: { item: AdminCrustDto | null; onClose: () => void }) {
  const t = useTranslations('admin.ingredients');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<CrustInput>({
    resolver: zodResolver(crustInputSchema),
    defaultValues: item
      ? {
          name: item.name,
          priceModifier: item.priceModifier,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder,
        }
      : { name: {}, priceModifier: 0, isAvailable: true, sortOrder: 0 },
  });
  const save = useMutation({
    mutationFn: (v: CrustInput) =>
      item ? adminApi.updateCrust(item.id, v) : adminApi.createCrust(v),
    onSuccess: (list) => {
      queryClient.setQueryData(qk.admin.crusts, list);
      toast.success(t('saved'));
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const submit = form.handleSubmit((v) => save.mutate(v));
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t('editCrust') : t('createCrust')}
      footer={
        <Button variant="primary" block loading={save.isPending} onClick={() => void submit()}>
          {t('save')}
        </Button>
      }
    >
      <form noValidate onSubmit={submit} className={styles.form}>
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <LocalizedInputs
              label={t('name')}
              value={field.value}
              onChange={field.onChange}
              error={form.formState.errors.name?.message}
            />
          )}
        />
        <div className={`${styles.cols} ${styles.cols2}`}>
          <Controller
            control={form.control}
            name="priceModifier"
            render={({ field }) => (
              <MoneyInput
                label={t('priceModifier')}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
              />
            )}
          />
          <Field label={t('sortOrder')}>
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                min={0}
                {...form.register('sortOrder', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <Checkbox label={t('isAvailable')} {...form.register('isAvailable')} />
      </form>
    </Dialog>
  );
}

function statusBadge(t: (k: string) => string, archived: boolean, available: boolean) {
  if (archived) return <Badge>{t('archived')}</Badge>;
  return available ? (
    <Badge tone="success">{t('available')}</Badge>
  ) : (
    <Badge tone="warning">{t('unavailable')}</Badge>
  );
}

export default function AdminIngredientsPage() {
  const t = useTranslations('admin.ingredients');
  const tCommon = useTranslations('common');
  const localize = useLocalize();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const ingredients = useQuery({ queryKey: qk.admin.ingredients, queryFn: adminApi.ingredients });
  const crusts = useQuery({ queryKey: qk.admin.crusts, queryFn: adminApi.crusts });
  const [ingredient, setIngredient] = useState<AdminIngredientDto | 'new' | null>(null);
  const [crust, setCrust] = useState<AdminCrustDto | 'new' | null>(null);

  const archiveIngredient = useMutation({
    mutationFn: (i: AdminIngredientDto) => adminApi.archiveIngredient(i.id, !i.isArchived),
    onSuccess: (list) => queryClient.setQueryData(qk.admin.ingredients, list),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const archiveCrust = useMutation({
    mutationFn: (c: AdminCrustDto) => adminApi.archiveCrust(c.id, !c.isArchived),
    onSuccess: (list) => queryClient.setQueryData(qk.admin.crusts, list),
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className={styles.form}>
      <PageHeader title={t('title')} />
      <Card title={t('ingredients')}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Button size="sm" variant="primary" onClick={() => setIngredient('new')}>
            <Plus size={16} aria-hidden /> {t('createIngredient')}
          </Button>
        </div>
        {ingredients.isPending ? (
          <TableSkeleton />
        ) : ingredients.isError ? (
          <ErrorState
            title={t('loadError')}
            action={<Button onClick={() => void ingredients.refetch()}>{tCommon('retry')}</Button>}
          />
        ) : (
          <div className={styles.tableWrap} style={{ boxShadow: 'none' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('name')}</th>
                  <th scope="col" className={styles.num}>
                    {t('extraPrice')}
                  </th>
                  <th scope="col">{t('status')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ingredients.data.map((i) => (
                  <tr key={i.id}>
                    <td>{localize(i.name)}</td>
                    <td className={styles.num}>{money.format(i.extraPrice)}</td>
                    <td>{statusBadge(t, i.isArchived, i.isAvailable)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button size="sm" onClick={() => setIngredient(i)}>
                          {t('edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => archiveIngredient.mutate(i)}
                        >
                          {i.isArchived ? t('restore') : t('archive')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('crusts')}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Button size="sm" variant="primary" onClick={() => setCrust('new')}>
            <Plus size={16} aria-hidden /> {t('createCrust')}
          </Button>
        </div>
        {crusts.isPending ? (
          <TableSkeleton />
        ) : crusts.isError ? (
          <ErrorState
            title={t('loadError')}
            action={<Button onClick={() => void crusts.refetch()}>{tCommon('retry')}</Button>}
          />
        ) : (
          <div className={styles.tableWrap} style={{ boxShadow: 'none' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('name')}</th>
                  <th scope="col" className={styles.num}>
                    {t('priceModifier')}
                  </th>
                  <th scope="col">{t('status')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {crusts.data.map((c) => (
                  <tr key={c.id}>
                    <td>{localize(c.name)}</td>
                    <td className={styles.num}>{money.format(c.priceModifier)}</td>
                    <td>{statusBadge(t, c.isArchived, c.isAvailable)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button size="sm" onClick={() => setCrust(c)}>
                          {t('edit')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => archiveCrust.mutate(c)}>
                          {c.isArchived ? t('restore') : t('archive')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {ingredient ? (
        <IngredientDialog
          item={ingredient === 'new' ? null : ingredient}
          onClose={() => setIngredient(null)}
        />
      ) : null}
      {crust ? (
        <CrustDialog item={crust === 'new' ? null : crust} onClose={() => setCrust(null)} />
      ) : null}
    </div>
  );
}
