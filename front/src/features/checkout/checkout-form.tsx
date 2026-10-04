'use client';
'use no memo';

import { addressSchema, type CreateOrderInput, nameSchema, phoneSchema, V } from '@market/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Price, SegmentedControl } from '@/components/ui/controls';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { useSession } from '@/features/auth/use-session';
import { CartSummary, canCheckout, PromoCodeForm } from '@/features/cart/cart-summary';
import { useCartQuote } from '@/features/cart/use-cart-quote';
import { meApi, ordersApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { applyServerFieldErrors, useErrorMessage } from '@/lib/errors';
import { useLocalize } from '@/lib/i18n-utils';
import { useStoreSettings } from '@/lib/money';
import { qk } from '@/lib/query/keys';
import { useStores } from '@/stores/root-store';
import { AddressFields, EMPTY_ADDRESS } from './address-form';
import styles from './checkout.module.css';

const formSchema = z.object({
  contactName: nameSchema,
  contactPhone: phoneSchema,
  comment: z.string().trim().max(500, V.tooLong).optional(),
  /** present only while the "new address" fields are mounted (shouldUnregister) */
  address: addressSchema.optional(),
  saveAddress: z.boolean().optional(),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export const CheckoutForm = observer(function CheckoutForm() {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const errorMessage = useErrorMessage();
  const localize = useLocalize();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cart, checkout } = useStores();
  const { user } = useSession();
  const settings = useStoreSettings();
  const quote = useCartQuote(cart, checkout.fulfillment);
  const addresses = useQuery({
    queryKey: qk.addresses,
    queryFn: meApi.addresses,
    enabled: Boolean(user),
  });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    shouldUnregister: true,
    defaultValues: {
      contactName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '',
      contactPhone: user?.phone ?? '',
      comment: '',
      saveAddress: true,
    },
  });

  // choose the default saved address once loaded; no saved addresses -> new address form
  useEffect(() => {
    if (!addresses.data) return;
    if (addresses.data.length === 0) checkout.setAddressMode('new');
    else if (!checkout.selectedAddressId) {
      checkout.selectAddress(
        (addresses.data.find((a) => a.isDefault) ?? addresses.data[0])?.id ?? null,
      );
    }
  }, [addresses.data, checkout]);

  const placeOrder = useMutation({
    mutationFn: async (values: FormOutput) => {
      const body: CreateOrderInput = {
        items: cart.items.map((i) => ({ ...i })),
        fulfillment: checkout.fulfillment,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
        comment: values.comment || undefined,
        promoCode: cart.promoCode ?? undefined,
        paymentMethod: checkout.paymentMethod,
        ...(checkout.fulfillment === 'DELIVERY'
          ? checkout.addressMode === 'saved' && checkout.selectedAddressId
            ? { addressId: checkout.selectedAddressId }
            : { address: values.address, saveAddress: Boolean(values.saveAddress) }
          : {}),
      };
      try {
        return await ordersApi.create(body, checkout.idempotencyKey);
      } catch (err) {
        // the payload changed since the previous attempt with this key: start a new attempt
        if (isApiError(err, 'IDEMPOTENCY_CONFLICT')) {
          checkout.renewIdempotencyKey();
          return ordersApi.create(body, checkout.idempotencyKey);
        }
        throw err;
      }
    },
    onSuccess: (order) => {
      cart.clear();
      checkout.renewIdempotencyKey();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: qk.addresses });
      if (order.payment?.method === 'CARD' && order.payment.status === 'PENDING') {
        router.push(`/checkout/pay/${order.id}`);
      } else {
        router.push(`/orders/${order.id}?placed=1`);
      }
    },
    onError: (err) => {
      const mapped = applyServerFieldErrors(err, form.setError, [
        'contactName',
        'contactPhone',
        'comment',
        'address.city',
        'address.street',
      ]);
      if (!mapped) toast.error(errorMessage(err));
      void quote.refetch();
    },
  });

  if (!cart.hydrated) return <Skeleton height={480} radius="var(--radius-lg)" />;
  if (cart.isEmpty && !placeOrder.isSuccess) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={tCart('emptyTitle')}
        action={
          <Button href="/menu" variant="primary">
            {tCart('toMenu')}
          </Button>
        }
      />
    );
  }

  const needsNewAddress =
    checkout.fulfillment === 'DELIVERY' &&
    (checkout.addressMode === 'new' || (addresses.data?.length ?? 0) === 0);
  const ready = canCheckout(quote.data) && !quote.isFetching;
  const submit = form.handleSubmit((values) => placeOrder.mutate(values));

  return (
    <form className={styles.page} onSubmit={submit} noValidate>
      <div className={styles.sections}>
        <h1 className={styles.title}>{t('title')}</h1>

        <section className={styles.section} aria-labelledby="fulfillment-title">
          <h2 id="fulfillment-title" className={styles.sectionTitle}>
            <span className={styles.step}>1</span> {t('fulfillment')}
          </h2>
          <SegmentedControl
            name="fulfillment"
            legend={t('fulfillment')}
            value={checkout.fulfillment}
            onChange={checkout.setFulfillment}
            options={[
              { value: 'DELIVERY', label: t('delivery') },
              { value: 'PICKUP', label: t('pickup') },
            ]}
          />
          {checkout.fulfillment === 'PICKUP' ? (
            <p className={styles.optionText}>
              {t('pickupFrom', { address: settings?.pickupAddress ?? '' })}
            </p>
          ) : addresses.isPending ? (
            <Skeleton height={64} />
          ) : (
            <>
              {(addresses.data?.length ?? 0) > 0 ? (
                <fieldset
                  className={styles.options}
                  style={{ border: 'none', padding: 0, margin: 0 }}
                >
                  <legend className="visually-hidden">{t('address')}</legend>
                  {addresses.data?.map((a) => (
                    <label key={a.id} className={styles.option}>
                      <input
                        type="radio"
                        name="addressChoice"
                        checked={
                          checkout.addressMode === 'saved' && checkout.selectedAddressId === a.id
                        }
                        onChange={() => checkout.selectAddress(a.id)}
                      />
                      <span>
                        <span className={styles.optionTitle}>{a.label || a.street}</span>
                        <span className={styles.optionText}>
                          {' '}
                          {[a.city, a.street, a.apartment && t('apt', { value: a.apartment })]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </span>
                    </label>
                  ))}
                  <label className={styles.option}>
                    <input
                      type="radio"
                      name="addressChoice"
                      checked={checkout.addressMode === 'new'}
                      onChange={() => checkout.setAddressMode('new')}
                    />
                    <span className={styles.optionTitle}>{t('newAddress')}</span>
                  </label>
                </fieldset>
              ) : null}
              {needsNewAddress ? <AddressBlock form={form} saveLabel={t('saveAddress')} /> : null}
            </>
          )}
        </section>

        <section className={styles.section} aria-labelledby="contact-title">
          <h2 id="contact-title" className={styles.sectionTitle}>
            <span className={styles.step}>2</span> {t('contact')}
          </h2>
          <div className={styles.twoCols}>
            <Field label={t('name')} error={form.formState.errors.contactName?.message}>
              {(a11y) => <Input {...a11y} autoComplete="name" {...form.register('contactName')} />}
            </Field>
            <Field
              label={t('phone')}
              hint={t('phoneHint')}
              error={form.formState.errors.contactPhone?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+374 91 000000"
                  {...form.register('contactPhone')}
                />
              )}
            </Field>
          </div>
          <Field label={t('comment')} optional error={form.formState.errors.comment?.message}>
            {(a11y) => (
              <Textarea {...a11y} rows={2} maxLength={500} {...form.register('comment')} />
            )}
          </Field>
        </section>

        <section className={styles.section} aria-labelledby="payment-title">
          <h2 id="payment-title" className={styles.sectionTitle}>
            <span className={styles.step}>3</span> {t('payment')}
          </h2>
          <fieldset className={styles.options} style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="visually-hidden">{t('payment')}</legend>
            {(['CARD', 'CASH'] as const).map((method) => (
              <label key={method} className={styles.option}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={checkout.paymentMethod === method}
                  onChange={() => checkout.setPaymentMethod(method)}
                />
                <span>
                  <span className={styles.optionTitle}>{t(`method.${method}`)}</span>
                  <br />
                  <span className={styles.optionText}>{t(`methodHint.${method}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      </div>

      <aside className={styles.summary} aria-label={t('summary')}>
        <h2 className={styles.sectionTitle}>{t('yourOrder')}</h2>
        <ul className={styles.summaryItems}>
          {quote.data?.lines.map((l) => (
            <li key={l.key} className={styles.summaryItem}>
              <span>
                {localize(l.name)} × {l.quantity}
              </span>
              <Price amount={l.lineTotal} showApprox={false} />
            </li>
          ))}
        </ul>
        <PromoCodeForm quote={quote.data} />
        {quote.data ? <CartSummary quote={quote.data} /> : <Skeleton height={140} />}
        <div className={styles.desktopOnly}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={placeOrder.isPending}
            disabled={!ready}
          >
            {t('placeOrder')}
          </Button>
        </div>
        <p className={styles.optionText}>{t('terms')}</p>
      </aside>

      <div className={styles.mobileBar}>
        {quote.data ? <Price amount={quote.data.total} /> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          loading={placeOrder.isPending}
          disabled={!ready}
        >
          {t('placeOrder')}
        </Button>
      </div>
    </form>
  );
});

function AddressBlock({
  form,
  saveLabel,
}: {
  form: UseFormReturn<FormInput, unknown, FormOutput>;
  saveLabel: string;
}) {
  // fields mount with defaults; unmounting removes them from the form (shouldUnregister)
  useEffect(() => {
    if (!form.getValues('address')) form.setValue('address', { ...EMPTY_ADDRESS });
  }, [form]);
  return (
    <>
      <AddressFields
        register={form.register}
        errors={form.formState.errors}
        setValue={form.setValue}
        watch={form.watch}
      />
      <Checkbox label={saveLabel} {...form.register('saveAddress')} />
    </>
  );
}
