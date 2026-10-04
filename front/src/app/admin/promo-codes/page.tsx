'use client';

import {
  PROMO_TYPES,
  type PromoCodeDto,
  type PromoCodeInput,
  promoCodeInputSchema,
} from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Pagination } from '@/components/ui/controls';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { MoneyInput, PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

/** <input type="datetime-local"> <-> ISO string with offset */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
const optionalInt = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));

function PromoDialog({ promo, onClose }: { promo: PromoCodeDto | null; onClose: () => void }) {
  const t = useTranslations('admin.promo');
  const localize = useLocalize();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: qk.admin.categories, queryFn: adminApi.categories });

  const form = useForm<PromoCodeInput>({
    resolver: zodResolver(promoCodeInputSchema),
    defaultValues: promo
      ? {
          code: promo.code,
          description: promo.description ?? '',
          type: promo.type,
          value: promo.value,
          maxDiscount: promo.maxDiscount,
          minOrderAmount: promo.minOrderAmount,
          startsAt: promo.startsAt,
          expiresAt: promo.expiresAt,
          usageLimit: promo.usageLimit,
          perUserLimit: promo.perUserLimit,
          isActive: promo.isActive,
          productIds: promo.productIds,
          categoryIds: promo.categoryIds,
        }
      : {
          code: '',
          description: '',
          type: 'PERCENT',
          value: 10,
          maxDiscount: null,
          minOrderAmount: 0,
          startsAt: null,
          expiresAt: null,
          usageLimit: null,
          perUserLimit: null,
          isActive: true,
          productIds: [],
          categoryIds: [],
        },
  });
  const type = form.watch('type');
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: (v: PromoCodeInput) =>
      promo ? adminApi.updatePromo(promo.id, v) : adminApi.createPromo(v),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promo'] });
      toast.success(t('saved'));
      onClose();
    },
    onError: (err) => {
      if (!applyServerFieldErrors(err, form.setError, ['code', 'value', 'expiresAt']))
        toast.error(errorMessage(err));
    },
  });
  const submit = form.handleSubmit((v) => save.mutate(v));

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={promo ? t('edit') : t('create')}
      footer={
        <Button variant="primary" block loading={save.isPending} onClick={() => void submit()}>
          {t('save')}
        </Button>
      }
    >
      <form noValidate onSubmit={submit} className={styles.form}>
        <div className={styles.cols}>
          <Field label={t('code')} error={errors.code?.message}>
            {(a11y) => (
              <Input {...a11y} style={{ textTransform: 'uppercase' }} {...form.register('code')} />
            )}
          </Field>
          <Field label={t('type')}>
            {(a11y) => (
              <Select {...a11y} {...form.register('type')}>
                {PROMO_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {t(`types.${p}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {type === 'PERCENT' ? (
            <Field label={t('percent')} error={errors.value?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="number"
                  min={1}
                  max={100}
                  {...form.register('value', { valueAsNumber: true })}
                />
              )}
            </Field>
          ) : (
            <Controller
              control={form.control}
              name="value"
              render={({ field }) => (
                <MoneyInput
                  label={t('amount')}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={errors.value?.message}
                />
              )}
            />
          )}
        </div>
        <Field label={t('description')} optional>
          {(a11y) => <Input {...a11y} {...form.register('description')} />}
        </Field>
        <div className={styles.cols}>
          <Controller
            control={form.control}
            name="minOrderAmount"
            render={({ field }) => (
              <MoneyInput
                label={t('minOrder')}
                value={field.value ?? 0}
                onChange={(v) => field.onChange(v ?? 0)}
              />
            )}
          />
          {type === 'PERCENT' ? (
            <Controller
              control={form.control}
              name="maxDiscount"
              render={({ field }) => (
                <MoneyInput
                  label={t('maxDiscount')}
                  allowNull
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          ) : null}
        </div>
        <div className={`${styles.cols} ${styles.cols2}`}>
          <Controller
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <Field label={t('startsAt')} optional>
                {(a11y) => (
                  <Input
                    {...a11y}
                    type="datetime-local"
                    value={toLocalInput(field.value)}
                    onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
                  />
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="expiresAt"
            render={({ field }) => (
              <Field label={t('expiresAt')} optional error={errors.expiresAt?.message}>
                {(a11y) => (
                  <Input
                    {...a11y}
                    type="datetime-local"
                    value={toLocalInput(field.value)}
                    onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
                  />
                )}
              </Field>
            )}
          />
        </div>
        <div className={`${styles.cols} ${styles.cols2}`}>
          <Field label={t('usageLimit')} optional>
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                min={1}
                {...form.register('usageLimit', { setValueAs: optionalInt })}
              />
            )}
          </Field>
          <Field label={t('perUserLimit')} optional>
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                min={1}
                {...form.register('perUserLimit', { setValueAs: optionalInt })}
              />
            )}
          </Field>
        </div>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{t('categories')}</legend>
          <p className={styles.muted} style={{ fontSize: 'var(--text-xs)' }}>
            {t('categoriesHint')}
          </p>
          <div className={styles.checkGrid}>
            {categories.data?.map((c) => (
              <Checkbox
                key={c.id}
                label={localize(c.name)}
                value={c.id}
                {...form.register('categoryIds')}
              />
            ))}
          </div>
        </fieldset>
        <Checkbox label={t('isActive')} {...form.register('isActive')} />
      </form>
    </Dialog>
  );
}

export default function AdminPromoPage() {
  const t = useTranslations('admin.promo');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PromoCodeDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PromoCodeDto | null>(null);
  const query = { q: q || undefined, page, pageSize: 25 };
  const promos = useQuery({
    queryKey: qk.admin.promo(query),
    queryFn: () => adminApi.promoCodes(query),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deletePromo(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promo'] });
      setDeleting(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setDeleting(null);
    },
  });

  const statusOf = (p: PromoCodeDto) => {
    const now = Date.now();
    if (!p.isActive) return <Badge>{t('inactive')}</Badge>;
    if (p.expiresAt && new Date(p.expiresAt).getTime() <= now)
      return <Badge tone="danger">{t('expired')}</Badge>;
    if (p.startsAt && new Date(p.startsAt).getTime() > now)
      return <Badge tone="info">{t('scheduled')}</Badge>;
    if (p.usageLimit !== null && p.usedCount >= p.usageLimit)
      return <Badge tone="warning">{t('exhausted')}</Badge>;
    return <Badge tone="success">{t('active')}</Badge>;
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden /> {t('create')}
          </Button>
        }
      />
      <div className={styles.toolbar}>
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {promos.isPending ? (
        <TableSkeleton />
      ) : promos.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void promos.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : promos.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('code')}</th>
                <th scope="col">{t('discount')}</th>
                <th scope="col">{t('usage')}</th>
                <th scope="col">{t('expiresAt')}</th>
                <th scope="col">{t('status')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {promos.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.code}</strong>
                    {p.description ? (
                      <>
                        <br />
                        <span className={styles.muted}>{p.description}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{p.type === 'PERCENT' ? `${p.value}%` : money.format(p.value)}</td>
                  <td className={styles.num}>
                    {p.usedCount}
                    {p.usageLimit !== null ? ` / ${p.usageLimit}` : ''}
                  </td>
                  <td className={styles.muted}>
                    {p.expiresAt
                      ? format.dateTime(new Date(p.expiresAt), { dateStyle: 'medium' })
                      : '—'}
                  </td>
                  <td>{statusOf(p)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button size="sm" onClick={() => setEditing(p)}>
                        {t('edit')}
                      </Button>
                      {p.usedCount === 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                          {t('delete')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={promos.data?.totalPages ?? 1} onChange={setPage} />
      {editing ? (
        <PromoDialog promo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteTitle', { code: deleting?.code ?? '' })}
        confirmLabel={t('delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
