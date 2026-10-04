'use client';

import { type AddressDto, type AddressInput, addressSchema } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/controls';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { AddressFields, EMPTY_ADDRESS } from '@/features/checkout/address-form';
import styles from '@/features/profile/account.module.css';
import { meApi } from '@/lib/api/endpoints';
import { useErrorMessage } from '@/lib/errors';
import { qk } from '@/lib/query/keys';

const formSchema = z.object({ address: addressSchema });
type FormInput = z.input<typeof formSchema>;

function toInput(a: AddressDto): AddressInput {
  return {
    label: a.label ?? '',
    country: a.country,
    city: a.city,
    street: a.street,
    apartment: a.apartment ?? '',
    entrance: a.entrance ?? '',
    floor: a.floor ?? '',
    intercom: a.intercom ?? '',
    instructions: a.instructions ?? '',
    latitude: a.latitude,
    longitude: a.longitude,
    isDefault: a.isDefault,
  };
}

function AddressDialog({ address, onClose }: { address: AddressDto | null; onClose: () => void }) {
  const t = useTranslations('account');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { address: address ? toInput(address) : { ...EMPTY_ADDRESS, isDefault: false } },
  });

  const save = useMutation({
    mutationFn: (values: AddressInput) =>
      address ? meApi.updateAddress(address.id, values) : meApi.createAddress(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.addresses });
      toast.success(t('addressSaved'));
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={address ? t('editAddress') : t('addAddress')}
      footer={
        <Button
          variant="primary"
          block
          loading={save.isPending}
          onClick={() => void form.handleSubmit((v) => save.mutate(v.address))()}
        >
          {t('save')}
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((v) => save.mutate(v.address))}
        style={{ display: 'grid', gap: 'var(--space-4)' }}
      >
        <Field
          label={t('addressLabel')}
          optional
          error={form.formState.errors.address?.label?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              placeholder={t('addressLabelPlaceholder')}
              {...form.register('address.label')}
            />
          )}
        </Field>
        <AddressFields
          register={form.register}
          errors={form.formState.errors}
          setValue={form.setValue}
          watch={form.watch}
        />
        <Checkbox label={t('makeDefault')} {...form.register('address.isDefault')} />
      </form>
    </Dialog>
  );
}

export default function AddressesPage() {
  const t = useTranslations('account');
  const tCommon = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: meApi.addresses });
  const [editing, setEditing] = useState<AddressDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AddressDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => meApi.deleteAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.addresses });
      setDeleting(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <section className={styles.panel} aria-labelledby="addresses-title">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <h1 id="addresses-title" className={styles.panelTitle}>
          {t('addressesTitle')}
        </h1>
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          {t('addAddress')}
        </Button>
      </div>
      {addresses.isPending ? (
        <Skeleton height={140} />
      ) : addresses.isError ? (
        <ErrorState
          title={t('loadError')}
          action={<Button onClick={() => void addresses.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : addresses.data.length === 0 ? (
        <EmptyState icon={MapPin} title={t('noAddresses')} text={t('noAddressesText')} />
      ) : (
        <ul className={styles.list}>
          {addresses.data.map((a) => (
            <li key={a.id} className={styles.item}>
              <div>
                <strong>{a.label || a.street}</strong>{' '}
                {a.isDefault ? <Badge tone="accent">{t('default')}</Badge> : null}
                <p className={styles.muted}>
                  {[a.city, a.street, a.apartment].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className={styles.actions}>
                <Button size="sm" onClick={() => setEditing(a)}>
                  {t('edit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(a)}>
                  {t('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <AddressDialog
          address={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteAddressTitle')}
        confirmLabel={t('delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
