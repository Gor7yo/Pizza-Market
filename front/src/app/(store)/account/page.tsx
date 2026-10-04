'use client';

import { type UpdateProfileInput, updateProfileSchema, type UserDto } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { CurrencySwitcher, LocaleSwitcher } from '@/components/layout/preferences';
import { useSession } from '@/features/auth/use-session';
import styles from '@/features/profile/account.module.css';
import fieldStyles from '@/components/ui/field.module.css';
import { meApi } from '@/lib/api/endpoints';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

function ProfileForm({ user }: { user: UserDto }) {
  const t = useTranslations('account');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
    },
  });

  const onUser = (next: UserDto) => queryClient.setQueryData(qk.me, next);

  const save = useMutation({
    mutationFn: meApi.update,
    onSuccess: (next) => {
      onUser(next);
      form.reset({
        firstName: next.firstName,
        lastName: next.lastName ?? '',
        phone: next.phone ?? '',
      });
      toast.success(t('saved'));
    },
    onError: (err) => {
      if (!applyServerFieldErrors(err, form.setError, ['firstName', 'lastName', 'phone']))
        toast.error(errorMessage(err));
    },
  });
  const upload = useMutation({
    mutationFn: meApi.uploadAvatar,
    onSuccess: onUser,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const removeAvatar = useMutation({ mutationFn: meApi.removeAvatar, onSuccess: onUser });

  return (
    <>
      <section className={styles.panel} aria-labelledby="profile-title">
        <h1 id="profile-title" className={styles.panelTitle}>
          {t('profileTitle')}
        </h1>
        <div className={styles.avatarRow}>
          <span className={styles.avatar}>
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={t('avatar')}
                fill
                sizes="72px"
                unoptimized
                style={{ objectFit: 'cover' }}
              />
            ) : (
              user.firstName.charAt(0).toUpperCase()
            )}
          </span>
          <div className={styles.actions}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
            <Button size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              {t('changeAvatar')}
            </Button>
            {user.avatarUrl ? (
              <Button
                size="sm"
                variant="ghost"
                loading={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
              >
                {t('removeAvatar')}
              </Button>
            ) : null}
          </div>
        </div>
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          style={{ display: 'grid', gap: 'var(--space-4)' }}
        >
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
          <div className={styles.row}>
            <Field label={t('email')} hint={user.emailVerified ? t('emailVerified') : undefined}>
              {(a11y) => <Input {...a11y} value={user.email} readOnly disabled />}
            </Field>
            <Field label={t('phone')} optional error={form.formState.errors.phone?.message}>
              {(a11y) => (
                <Input {...a11y} type="tel" autoComplete="tel" {...form.register('phone')} />
              )}
            </Field>
          </div>
          <div>
            <Button
              type="submit"
              variant="primary"
              loading={save.isPending}
              disabled={!form.formState.isDirty}
            >
              {t('save')}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="prefs-title">
        <h2 id="prefs-title" className={styles.panelTitle}>
          {t('preferences')}
        </h2>
        <div className={styles.row}>
          <div>
            <p className={styles.muted}>{t('language')}</p>
            <LocaleSwitcher className={fieldStyles.control} />
          </div>
          <div>
            <p className={styles.muted}>{t('displayCurrency')}</p>
            <CurrencySwitcher className={fieldStyles.control} />
            <p className={styles.muted}>{t('displayCurrencyHint')}</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function AccountPage() {
  const { user } = useSession();
  if (!user) return <Skeleton height={420} radius="var(--radius-lg)" />;
  return <ProfileForm user={user} />;
}
