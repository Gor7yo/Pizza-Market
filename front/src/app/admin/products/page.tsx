'use client';

import type { AdminProductDto } from '@market/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/common/product-image';
import { Button } from '@/components/ui/button';
import { Badge, Pagination } from '@/components/ui/controls';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { qk } from '@/lib/query/keys';

type Status = '' | 'active' | 'unavailable' | 'archived';

export default function AdminProductsPage() {
  const t = useTranslations('admin.products');
  const tCommon = useTranslations('common');
  const localize = useLocalize();
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  };
  const products = useQuery({
    queryKey: qk.admin.products(query),
    queryFn: () => adminApi.products(query),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: qk.admin.categories, queryFn: adminApi.categories });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });

  const bulk = useMutation({
    mutationFn: async (action: 'available' | 'unavailable' | 'archive') => {
      for (const id of selected) {
        if (action === 'archive') await adminApi.archiveProduct(id, true);
        else await adminApi.setProductAvailability(id, action === 'available');
      }
    },
    onSuccess: () => {
      toast.success(t('bulkDone'));
      setSelected(new Set());
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: invalidate,
  });

  const toggleOne = useMutation({
    mutationFn: (p: AdminProductDto) =>
      p.isArchived
        ? adminApi.archiveProduct(p.id, false)
        : adminApi.setProductAvailability(p.id, !p.isAvailable),
    onSuccess: invalidate,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = products.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button href="/admin/products/new" variant="primary">
            <Plus size={16} aria-hidden /> {t('create')}
          </Button>
        }
      />
      <div className={styles.toolbar}>
        <Input
          type="search"
          placeholder={t('search')}
          aria-label={t('search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label={t('category')}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allCategories')}</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {localize(c.name)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status);
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="active">{t('statusActive')}</option>
          <option value="unavailable">{t('statusUnavailable')}</option>
          <option value="archived">{t('statusArchived')}</option>
        </Select>
      </div>

      {selected.size > 0 ? (
        <div className={styles.toolbar} role="region" aria-label={t('bulkLabel')}>
          <span style={{ alignSelf: 'center' }}>{t('selected', { count: selected.size })}</span>
          <Button size="sm" loading={bulk.isPending} onClick={() => bulk.mutate('available')}>
            {t('makeAvailable')}
          </Button>
          <Button size="sm" loading={bulk.isPending} onClick={() => bulk.mutate('unavailable')}>
            {t('makeUnavailable')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={bulk.isPending}
            onClick={() => bulk.mutate('archive')}
          >
            {t('archive')}
          </Button>
        </div>
      ) : null}

      {products.isPending ? (
        <TableSkeleton />
      ) : products.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void products.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">
                  <input
                    type="checkbox"
                    aria-label={t('selectAll')}
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(items.map((p) => p.id)))
                    }
                  />
                </th>
                <th scope="col">{t('name')}</th>
                <th scope="col">{t('category')}</th>
                <th scope="col" className={styles.num}>
                  {t('price')}
                </th>
                <th scope="col">{t('status')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const name = localize(p.name);
                return (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={t('select', { name })}
                        checked={selected.has(p.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td>
                      <div className={styles.cellMain}>
                        <span className={styles.thumb}>
                          <ProductImage src={p.imageUrl} alt="" seed={p.slug} sizes="44px" />
                        </span>
                        <span>
                          <Link href={`/admin/products/${p.id}`}>
                            <strong>{name}</strong>
                          </Link>
                          <br />
                          <span className={styles.muted}>/{p.slug}</span>
                        </span>
                      </div>
                    </td>
                    <td>{localize(p.category.name)}</td>
                    <td className={styles.num}>{money.format(p.fromPrice)}</td>
                    <td>
                      {p.isArchived ? (
                        <Badge>{t('statusArchived')}</Badge>
                      ) : p.isAvailable ? (
                        <Badge tone="success">{t('statusActive')}</Badge>
                      ) : (
                        <Badge tone="warning">{t('statusUnavailable')}</Badge>
                      )}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <Button size="sm" href={`/admin/products/${p.id}`}>
                          {t('edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleOne.mutate(p)}
                          disabled={toggleOne.isPending}
                        >
                          {p.isArchived
                            ? t('restore')
                            : p.isAvailable
                              ? t('makeUnavailable')
                              : t('makeAvailable')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={products.data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}
