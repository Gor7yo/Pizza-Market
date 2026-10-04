'use client';

import { type AdminCategoryDto, type CategoryInput, categoryInputSchema } from '@market/shared';
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
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Checkbox, Field, Input } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { LocalizedInputs, PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { qk } from '@/lib/query/keys';

function CategoryDialog({
  category,
  onClose,
}: {
  category: AdminCategoryDto | null;
  onClose: () => void;
}) {
  const t = useTranslations('admin.categories');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: category
      ? {
          slug: category.slug,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
        }
      : { slug: '', name: {}, sortOrder: 0, isActive: true },
  });
  const save = useMutation({
    mutationFn: (v: CategoryInput) =>
      category ? adminApi.updateCategory(category.id, v) : adminApi.createCategory(v),
    onSuccess: (list) => {
      queryClient.setQueryData(qk.admin.categories, list);
      toast.success(t('saved'));
      onClose();
    },
    onError: (err) => {
      if (!applyServerFieldErrors(err, form.setError, ['slug'])) toast.error(errorMessage(err));
    },
  });
  const submit = form.handleSubmit((v) => save.mutate(v));

  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? t('edit') : t('create')}
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
          <Field label={t('slug')} error={form.formState.errors.slug?.message}>
            {(a11y) => <Input {...a11y} {...form.register('slug')} />}
          </Field>
          <Field label={t('sortOrder')} error={form.formState.errors.sortOrder?.message}>
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
        <Checkbox label={t('isActive')} {...form.register('isActive')} />
      </form>
    </Dialog>
  );
}

export default function AdminCategoriesPage() {
  const t = useTranslations('admin.categories');
  const tCommon = useTranslations('common');
  const localize = useLocalize();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: qk.admin.categories, queryFn: adminApi.categories });
  const [editing, setEditing] = useState<AdminCategoryDto | 'new' | null>(null);

  const archive = useMutation({
    mutationFn: (c: AdminCategoryDto) => adminApi.archiveCategory(c.id, !c.isArchived),
    onSuccess: (list) => queryClient.setQueryData(qk.admin.categories, list),
    onError: (err) => toast.error(errorMessage(err)),
  });

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
      {categories.isPending ? (
        <TableSkeleton />
      ) : categories.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void categories.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : categories.data.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('name')}</th>
                <th scope="col">{t('slug')}</th>
                <th scope="col" className={styles.num}>
                  {t('products')}
                </th>
                <th scope="col">{t('status')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{localize(c.name)}</strong>
                  </td>
                  <td className={styles.muted}>{c.slug}</td>
                  <td className={styles.num}>{c.productCount}</td>
                  <td>
                    {c.isArchived ? (
                      <Badge>{t('archived')}</Badge>
                    ) : c.isActive ? (
                      <Badge tone="success">{t('active')}</Badge>
                    ) : (
                      <Badge tone="warning">{t('hidden')}</Badge>
                    )}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button size="sm" onClick={() => setEditing(c)}>
                        {t('edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => archive.mutate(c)}
                        disabled={archive.isPending}
                      >
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
      {editing ? (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
