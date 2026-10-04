'use client';

import { verificationCodeSchema } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import styles from '@/features/auth/auth.module.css';
import { safeNext } from '@/features/auth/safe-next';
import { authApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

const RESEND_SECONDS = 60;
const schema = z.object({ code: verificationCodeSchema });

function VerifyForm() {
  const t = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const email = params.get('email') ?? '';
  const next = safeNext(params.get('next'));
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verifyEmail({ email, code }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(qk.me, user);
      toast.success(t('verified'));
      router.replace(next);
      router.refresh();
    },
    onError: (err) => {
      setFormError(errorMessage(err));
      form.setFocus('code');
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification({ email }),
    onSuccess: () => {
      setCooldown(RESEND_SECONDS);
      toast.success(t('codeResent'));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!email) {
    return <p className={styles.alert}>{t('verifyNoEmail')}</p>;
  }

  return (
    <>
      <h1 className={styles.title}>{t('verifyTitle')}</h1>
      <p className={styles.subtitle}>{t('verifySubtitle', { email })}</p>
      <form
        className={styles.form}
        noValidate
        onSubmit={form.handleSubmit(({ code }) => {
          setFormError(null);
          verify.mutate(code);
        })}
      >
        {formError ? (
          <p className={styles.alert} role="alert">
            {formError}
          </p>
        ) : null}
        <Field label={t('code')} error={form.formState.errors.code?.message}>
          {(a11y) => (
            <Input
              {...a11y}
              className={styles.codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              {...form.register('code')}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={verify.isPending}>
          {t('verifySubmit')}
        </Button>
        <Button
          variant="ghost"
          block
          disabled={cooldown > 0}
          loading={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
        </Button>
      </form>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
