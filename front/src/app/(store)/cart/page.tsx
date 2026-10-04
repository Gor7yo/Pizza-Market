'use client';
'use no memo';

import { ShoppingBag } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import styles from '@/features/cart/cart.module.css';
import { CartLines } from '@/features/cart/cart-lines';
import { CartSummary, CheckoutButton, PromoCodeForm } from '@/features/cart/cart-summary';
import { useCartQuote } from '@/features/cart/use-cart-quote';
import { useStores } from '@/stores/root-store';

const CartPage = observer(function CartPage() {
  const t = useTranslations('cart');
  const tCommon = useTranslations('common');
  const { cart } = useStores();
  const quote = useCartQuote(cart);

  if (!cart.hydrated) {
    return (
      <div className="container" aria-busy>
        <div className={styles.page}>
          <Skeleton height={320} radius="var(--radius-lg)" />
          <Skeleton height={240} radius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  if (cart.isEmpty) {
    return (
      <div className="container">
        <EmptyState
          icon={ShoppingBag}
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            <Button href="/menu" variant="primary">
              {t('toMenu')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container">
      <div className={styles.page}>
        <section className={styles.panel} aria-labelledby="cart-title">
          <h1 id="cart-title" style={{ fontSize: 'var(--text-2xl)' }}>
            {t('title')}
          </h1>
          {quote.isError && !quote.data ? (
            <ErrorState
              title={t('quoteError')}
              action={<Button onClick={() => void quote.refetch()}>{tCommon('retry')}</Button>}
            />
          ) : (
            <CartLines priced={quote.data?.lines} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={cart.clear}>
              {t('clear')}
            </Button>
          </div>
        </section>
        <aside className={`${styles.panel} ${styles.sticky}`} aria-label={t('summary')}>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <PromoCodeForm quote={quote.data} />
            {quote.data ? <CartSummary quote={quote.data} /> : <Skeleton height={160} />}
            <CheckoutButton quote={quote.data} />
          </div>
        </aside>
      </div>
    </div>
  );
});

export default CartPage;
