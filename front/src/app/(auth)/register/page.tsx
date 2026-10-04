'use client';

import { registerSchema, V } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import styles from '@/features/auth/auth.module.css';
import { GoogleButton } from '@/features/auth/google-button';
import { safeNext } from '@/features/auth/safe-next';
import { authApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';

/** Same rules as the API + a UX-only confirmation field. */
const formSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: V.passwordsMismatch,
    path: ['confirmPassword'],
  });

type FormInput = z.input<typeof formSchema>;

function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
  });

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: (result) => {
      router.push(
        `/verify-email?email=${encodeURIComponent(result.email)}&next=${encodeURIComponent(next)}`,
      );
    },
    onError: (err) => {
      if (
        !applyServerFieldErrors(err, form.setError, ['email', 'password', 'firstName', 'lastName'])
      ) {
        setFormError(errorMessage(err));
      }
    },
  });

  return (
    <>
      <h1 className={styles.title}>{t('registerTitle')}</h1>
      <p className={styles.subtitle}>{t('registerSubtitle')}</p>
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit(({ confirmPassword: _confirm, ...values }) => {
          setFormError(null);
          register.mutate({ ...values, locale: locale as 'ru' | 'en' | 'hy' });
        })}
      >
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}
        <div className={styles.row}>
          <Field label={t('firstName')} error={form.formState.errors.firstName?.message}>
            {(a11y) => (
              <Input {...a11y} autoComplete="given-name" {...form.register('firstName')} />
            )}
          </Field>
          <Field label={t('lastName')} optional error={form.formState.errors.lastName?.message}>
            {(a11y) => (
              <Input {...a11y} autoComplete="family-name" {...form.register('lastName')} />
            )}
          </Field>
        </div>
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
        <Field
          label={t('password')}
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
        <Button type="submit" variant="primary" size="lg" block loading={register.isPending}>
          {t('registerSubmit')}
        </Button>
        <GoogleButton next={next} />
        <p className={styles.links}>
          <span>
            {t('haveAccount')}{' '}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.link}>
              {t('loginLink')}
            </Link>
          </span>
        </p>
      </form>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
