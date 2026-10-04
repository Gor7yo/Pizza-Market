'use client';
'use no memo';

import type { CartQuoteDto } from '@market/shared';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/controls';
import { Input } from '@/components/ui/field';
import { useMoney } from '@/lib/money';
import { useStores } from '@/stores/root-store';
import styles from './cart.module.css';

export const PromoCodeForm = observer(function PromoCodeForm({
  quote,
}: {
  quote: CartQuoteDto | undefined;
}) {
  const t = useTranslations('cart');
  const tErrors = useTranslations('errors');
  const { cart } = useStores();
  const [value, setValue] = useState('');
  const promo = quote?.promo;

  if (cart.promoCode && promo?.applied) {
    return (
      <div className={styles.promoApplied} role="status">
        <span>{t('promoApplied', { code: promo.code })}</span>
        <button type="button" className={styles.textButton} onClick={() => cart.setPromoCode(null)}>
          {t('remove')}
        </button>
      </div>
    );
  }

  const apply = () => {
    if (value.trim()) cart.setPromoCode(value);
  };

  // Not a <form>: this block is also rendered inside the checkout form,
  // and nested forms are invalid HTML (Enter would submit the order).
  return (
    <div>
      <div className={styles.promo} role="group" aria-label={t('promoLabel')}>
        <label htmlFor="promo-code" className="visually-hidden">
          {t('promoLabel')}
        </label>
        <Input
          id="promo-code"
          className={styles.promoInput}
          placeholder={t('promoPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          autoComplete="off"
          maxLength={32}
        />
        <Button variant="outline" disabled={!value.trim()} onClick={apply}>
          {t('apply')}
        </Button>
      </div>
      {cart.promoCode && promo && !promo.applied && promo.errorCode ? (
        <p className={styles.promoError} role="alert">
          {tErrors(promo.errorCode)}
        </p>
      ) : null}
    </div>
  );
});

/** Transparent price breakdown, entirely from the server quote. */
export function CartSummary({ quote }: { quote: CartQuoteDto }) {
  const t = useTranslations('cart');
  const { format } = useMoney();
  const discounted = quote.subtotal - quote.discount;
  const freeLeft =
    quote.freeDeliveryThreshold !== null ? quote.freeDeliveryThreshold - discounted : null;
  const belowMinimum = discounted < quote.minOrderAmount;

  return (
    <div className={styles.summary}>
      <div className={styles.row}>
        <span className={styles.muted}>{t('subtotal')}</span>
        <Price amount={quote.subtotal} showApprox={false} />
      </div>
      {quote.discount > 0 ? (
        <div className={`${styles.row} ${styles.discount}`}>
          <span>{t('discount')}</span>
          <span>−{format(quote.discount)}</span>
        </div>
      ) : null}
      <div className={styles.row}>
        <span className={styles.muted}>{t('delivery')}</span>
        <span>{quote.deliveryFee === 0 ? t('free') : format(quote.deliveryFee)}</span>
      </div>
      {freeLeft !== null && freeLeft > 0 ? (
        <div>
          <p className={styles.hint}>{t('freeDeliveryLeft', { amount: format(freeLeft) })}</p>
          <div className={styles.progress} aria-hidden>
            <div
              className={styles.progressBar}
              style={{
                width: `${Math.min(100, (discounted / (quote.freeDeliveryThreshold ?? 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      <div className={`${styles.row} ${styles.total}`}>
        <span>{t('total')}</span>
        <Price amount={quote.total} />
      </div>
      {belowMinimum ? (
        <p className={styles.warning} role="status">
          {t('minOrder', { amount: format(quote.minOrderAmount) })}
        </p>
      ) : null}
      {!quote.isAcceptingOrders ? (
        <p className={styles.warning} role="status">
          {t('storeClosed')}
        </p>
      ) : null}
    </div>
  );
}

export function canCheckout(quote: CartQuoteDto | undefined): boolean {
  if (!quote) return false;
  return (
    quote.isAcceptingOrders &&
    quote.lines.length > 0 &&
    quote.lines.every((l) => l.available) &&
    quote.subtotal - quote.discount >= quote.minOrderAmount
  );
}

export const CheckoutButton = observer(function CheckoutButton({
  quote,
  onNavigate,
}: {
  quote: CartQuoteDto | undefined;
  onNavigate?: () => void;
}) {
  const t = useTranslations('cart');
  const hasUnavailable = quote?.lines.some((l) => !l.available);
  return (
    <>
      {hasUnavailable ? <p className={styles.warning}>{t('removeUnavailable')}</p> : null}
      {canCheckout(quote) ? (
        <span onClickCapture={onNavigate}>
          <Button href="/checkout" variant="primary" size="lg" block>
            {t('checkout')}
          </Button>
        </span>
      ) : (
        <Button variant="primary" size="lg" block disabled>
          {t('checkout')}
        </Button>
      )}
    </>
  );
});
