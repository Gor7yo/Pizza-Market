'use client';

import { passwordSchema, V } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import styles from '@/features/auth/auth.module.css';
import { authApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: V.passwordsMismatch,
    path: ['confirmPassword'],
  });

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  // The token arrives in the URL fragment, which is never sent to any server.
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    setToken(value);
    if (value) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const reset = useMutation({
    mutationFn: (password: string) => authApi.resetPassword({ token: token ?? '', password }),
    onSuccess: () => router.replace('/login?reset=1'),
  });

  if (token === undefined) return null;
  if (!token) {
    return (
      <>
        <h1 className={styles.title}>{t('resetTitle')}</h1>
        <p className={`${styles.alert} ${styles.form}`}>{t('resetInvalid')}</p>
        <p className={styles.links} style={{ marginTop: 'var(--space-6)' }}>
          <Link href="/forgot-password" className={styles.link}>
            {t('forgotTitle')}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>{t('resetTitle')}</h1>
      <p className={styles.subtitle}>{t('resetSubtitle')}</p>
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((v) => reset.mutate(v.password))}
      >
        {reset.isError ? (
          <p className={styles.alert} role="alert">
            {errorMessage(reset.error)}
          </p>
        ) : null}
        <Field
          label={t('newPassword')}
          hint={t('passwordHint')}
          error={form.formState.errors.password?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
          )}
        </Field>
        <Field label={t('confirmPassword')} error={form.formState.errors.confirmPassword?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={reset.isPending}>
          {t('resetSubmit')}
        </Button>
      </form>
    </>
  );
}
