'use client';

import { type AdminUserDto, type UserRole, USER_ROLES } from '@market/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Pagination } from '@/components/ui/controls';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import { useSession } from '@/features/auth/use-session';
import styles from '@/features/admin/admin.module.css';
import { PageHeader, TableSkeleton } from '@/features/admin/ui';
import { adminApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

type PendingAction = { user: AdminUserDto; change: { role?: UserRole; isBlocked?: boolean } };

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { user: me } = useSession();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const query = { q: q || undefined, role: role || undefined, page, pageSize: 25 };
  const users = useQuery({
    queryKey: qk.admin.users(query),
    queryFn: () => adminApi.users(query),
    placeholderData: keepPreviousData,
  });

  const update = useMutation({
    mutationFn: (a: PendingAction) => adminApi.updateUser(a.user.id, a.change),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('updated'));
      setPending(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setPending(null);
    },
  });

  return (
    <>
      <PageHeader title={t('title')} />
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
        <Select
          aria-label={t('role')}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as UserRole | '');
            setPage(1);
          }}
        >
          <option value="">{t('allRoles')}</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </Select>
      </div>
      {users.isPending ? (
        <TableSkeleton />
      ) : users.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void users.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : users.data.items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('user')}</th>
                <th scope="col">{t('role')}</th>
                <th scope="col">{t('status')}</th>
                <th scope="col" className={styles.num}>
                  {t('orders')}
                </th>
                <th scope="col">{t('registered')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <strong>{[u.firstName, u.lastName].filter(Boolean).join(' ')}</strong>
                      <br />
                      <span className={styles.muted}>{u.email}</span>
                    </td>
                    <td>
                      <Badge tone={u.role === 'ADMIN' ? 'primary' : 'neutral'}>
                        {t(`roles.${u.role}`)}
                      </Badge>
                    </td>
                    <td>
                      {u.isBlocked ? (
                        <Badge tone="danger">{t('blocked')}</Badge>
                      ) : u.emailVerified ? (
                        <Badge tone="success">{t('active')}</Badge>
                      ) : (
                        <Badge tone="warning">{t('unverified')}</Badge>
                      )}
                    </td>
                    <td className={styles.num}>{u.orderCount}</td>
                    <td className={styles.muted}>
                      {format.dateTime(new Date(u.createdAt), { dateStyle: 'medium' })}
                    </td>
                    <td>
                      {self ? (
                        <span className={styles.muted}>{t('you')}</span>
                      ) : (
                        <div className={styles.rowActions}>
                          <Button
                            size="sm"
                            onClick={() =>
                              setPending({
                                user: u,
                                change: { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' },
                              })
                            }
                          >
                            {u.role === 'ADMIN' ? t('revokeAdmin') : t('makeAdmin')}
                          </Button>
                          <Button
                            size="sm"
                            variant={u.isBlocked ? 'outline' : 'danger'}
                            onClick={() =>
                              setPending({ user: u, change: { isBlocked: !u.isBlocked } })
                            }
                          >
                            {u.isBlocked ? t('unblock') : t('block')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={users.data?.totalPages ?? 1} onChange={setPage} />
      <ConfirmDialog
        open={pending !== null}
        title={t('confirmTitle')}
        description={pending ? t('confirmText', { email: pending.user.email }) : undefined}
        confirmLabel={t('confirm')}
        danger={pending?.change.isBlocked === true}
        loading={update.isPending}
        onConfirm={() => pending && update.mutate(pending)}
        onClose={() => setPending(null)}
      />
    </>
  );
}
