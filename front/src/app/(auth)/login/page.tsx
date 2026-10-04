'use client';

import { type LoginInput, loginSchema } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import styles from '@/features/auth/auth.module.css';
import { GoogleButton } from '@/features/auth/google-button';
import { safeNext } from '@/features/auth/safe-next';
import { authApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

function LoginForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const next = safeNext(params.get('next'));
  const oauthError = params.get('error');
  const [formError, setFormError] = useState<string | null>(
    oauthError ? (tErrors.has(oauthError) ? tErrors(oauthError) : tErrors('OAUTH_FAILED')) : null,
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(qk.me, user);
      router.replace(next);
      router.refresh();
    },
    onError: async (err, values) => {
      if (isApiError(err, 'EMAIL_NOT_VERIFIED')) {
        await authApi.resendVerification({ email: values.email }).catch(() => undefined);
        router.push(
          `/verify-email?email=${encodeURIComponent(values.email)}&next=${encodeURIComponent(next)}`,
        );
        return;
      }
      if (!applyServerFieldErrors(err, form.setError, ['email', 'password']))
        setFormError(errorMessage(err));
    },
  });

  return (
    <>
      <h1 className={styles.title}>{t('loginTitle')}</h1>
      <p className={styles.subtitle}>{t('loginSubtitle')}</p>
      {params.get('reset') ? (
        <p className={styles.success} role="status">
          {t('resetDone')}
        </p>
      ) : null}
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setFormError(null);
          login.mutate(values);
        })}
      >
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}
        <Field label={t('email')} error={form.formState.errors.email?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register('email')}
            />
          )}
        </Field>
        <Field label={t('password')} error={form.formState.errors.password?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          )}
        </Field>
        <div className={styles.links}>
          <Link href="/forgot-password" className={styles.link}>
            {t('forgot')}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" block loading={login.isPending}>
          {t('loginSubmit')}
        </Button>
        <GoogleButton next={next} />
        <p className={styles.links}>
          <span>
            {t('noAccount')}{' '}
            <Link href={`/register?next=${encodeURIComponent(next)}`} className={styles.link}>
              {t('registerLink')}
            </Link>
          </span>
        </p>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
