'use client';

import { type EmailOnlyInput, emailOnlySchema } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import styles from '@/features/auth/auth.module.css';
import { authApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const form = useForm<EmailOnlyInput>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  const request = useMutation({ mutationFn: authApi.forgotPassword });

  return (
    <>
      <h1 className={styles.title}>{t('forgotTitle')}</h1>
      <p className={styles.subtitle}>{t('forgotSubtitle')}</p>
      {request.isSuccess ? (
        // the same message whether or not the account exists
        <p className={`${styles.success} ${styles.form}`} role="status">
          {t('forgotSent')}
        </p>
      ) : (
        <form
          className={styles.form}
          noValidate
          onSubmit={form.handleSubmit((v) => request.mutate(v))}
        >
          {request.isError ? (
            <p className={styles.alert} role="alert">
              {errorMessage(request.error)}
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
          <Button type="submit" variant="primary" size="lg" block loading={request.isPending}>
            {t('forgotSubmit')}
          </Button>
        </form>
      )}
      <p className={styles.links} style={{ marginTop: 'var(--space-6)' }}>
        <Link href="/login" className={styles.link}>
          {t('backToLogin')}
        </Link>
      </p>
    </>
  );
}
