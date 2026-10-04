'use client';

import { passwordSchema, V } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { useSession } from '@/features/auth/use-session';
import styles from '@/features/profile/account.module.css';
import { authApi, meApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

const schema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: V.passwordsMismatch,
    path: ['confirmPassword'],
  });
type FormInput = z.input<typeof schema>;

function describeAgent(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return [browser, os].filter(Boolean).join(' · ');
}

export default function SecurityPage() {
  const t = useTranslations('account');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  // explicit reference time (refreshed every minute) instead of the implicit Date.now() fallback
  const now = useNow({ updateInterval: 60_000 });
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: meApi.sessions });

  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const change = useMutation({
    mutationFn: (v: FormInput) =>
      meApi.changePassword({
        currentPassword: v.currentPassword || undefined,
        newPassword: v.newPassword,
      }),
    onSuccess: () => {
      form.reset();
      toast.success(t('passwordChanged'));
      void queryClient.invalidateQueries({ queryKey: qk.sessions });
      void queryClient.invalidateQueries({ queryKey: qk.me });
    },
    onError: (err) => {
      if (!applyServerFieldErrors(err, form.setError, ['currentPassword', 'newPassword']))
        toast.error(errorMessage(err));
    },
  });

  const revoke = useMutation({
    mutationFn: meApi.revokeSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.sessions }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSettled: () => {
      queryClient.setQueryData(qk.me, null);
      router.push('/login');
      router.refresh();
    },
  });

  return (
    <>
      <section className={styles.panel} aria-labelledby="password-title">
        <h1 id="password-title" className={styles.panelTitle}>
          {user?.hasPassword ? t('changePassword') : t('setPassword')}
        </h1>
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => change.mutate(v))}
          style={{ display: 'grid', gap: 'var(--space-4)' }}
        >
          {user?.hasPassword ? (
            <Field
              label={t('currentPassword')}
              error={form.formState.errors.currentPassword?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="current-password"
                  {...form.register('currentPassword')}
                />
              )}
            </Field>
          ) : null}
          <div className={styles.row}>
            <Field label={t('newPassword')} error={form.formState.errors.newPassword?.message}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="new-password"
                  {...form.register('newPassword')}
                />
              )}
            </Field>
            <Field
              label={t('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                />
              )}
            </Field>
          </div>
          <p className={styles.muted}>{t('passwordChangeNote')}</p>
          <div>
            <Button type="submit" variant="primary" loading={change.isPending}>
              {t('save')}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="sessions-title">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <h2 id="sessions-title" className={styles.panelTitle}>
            {t('sessions')}
          </h2>
          <Button
            size="sm"
            variant="danger"
            loading={logoutAll.isPending}
            onClick={() => logoutAll.mutate()}
          >
            {t('logoutAll')}
          </Button>
        </div>
        {sessions.isPending ? (
          <Skeleton height={120} />
        ) : sessions.isError ? (
          <ErrorState
            title={t('loadError')}
            action={<Button onClick={() => void sessions.refetch()}>{tCommon('retry')}</Button>}
          />
        ) : (
          <ul className={styles.list}>
            {sessions.data.map((s) => (
              <li key={s.id} className={styles.item}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <Monitor size={22} aria-hidden />
                  <div>
                    <strong>{describeAgent(s.userAgent)}</strong>{' '}
                    {s.current ? <Badge tone="success">{t('thisDevice')}</Badge> : null}
                    <p className={styles.muted}>
                      {s.ip ?? '—'} · {t('lastActive')}{' '}
                      {format.relativeTime(new Date(s.lastUsedAt), now)}
                    </p>
                  </div>
                </div>
                {!s.current ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke.mutate(s.id)}
                    disabled={revoke.isPending}
                  >
                    {t('revoke')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
