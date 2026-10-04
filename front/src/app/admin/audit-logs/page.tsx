'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/controls';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import styles from '@/features/admin/admin.module.css';
import { PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { qk } from '@/lib/query/keys';

const ENTITY_TYPES = [
  'Product',
  'Category',
  'Ingredient',
  'Crust',
  'Order',
  'User',
  'PromoCode',
  'Review',
  'Setting',
];

export default function AuditLogsPage() {
  const t = useTranslations('admin.audit');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const query = {
    entityType: entityType || undefined,
    action: action || undefined,
    page,
    pageSize: 30,
  };
  const logs = useQuery({
    queryKey: qk.admin.audit(query),
    queryFn: () => adminApi.auditLogs(query),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title={t('title')} />
      <div className={styles.toolbar}>
        <Select
          aria-label={t('entity')}
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allEntities')}</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Input
          type="search"
          aria-label={t('action')}
          placeholder={t('actionPlaceholder')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {logs.isPending ? (
        <TableSkeleton />
      ) : logs.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void logs.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : logs.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('time')}</th>
                <th scope="col">{t('actor')}</th>
                <th scope="col">{t('action')}</th>
                <th scope="col">{t('entity')}</th>
                <th scope="col">{t('details')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.items.map((log) => (
                <tr key={log.id}>
                  <td className={styles.muted} style={{ whiteSpace: 'nowrap' }}>
                    {format.dateTime(new Date(log.createdAt), {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td>
                    {log.actor?.email ?? '—'}
                    {log.ip ? (
                      <>
                        <br />
                        <span className={styles.muted}>{log.ip}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <code>{log.action}</code>
                  </td>
                  <td>
                    {log.entityType}
                    <br />
                    <span className={styles.muted}>{log.entityId?.slice(0, 8) ?? ''}</span>
                  </td>
                  <td>
                    <details>
                      <summary>{t('show')}</summary>
                      <pre className={styles.pre}>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={logs.data?.totalPages ?? 1} onChange={setPage} />
    </>
  );
}
