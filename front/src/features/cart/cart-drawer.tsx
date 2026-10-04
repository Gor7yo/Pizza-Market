'use client';
'use no memo';

import { ShoppingBag } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { useStores } from '@/stores/root-store';
import styles from './cart.module.css';
import { CartLines } from './cart-lines';
import { CartSummary, CheckoutButton, PromoCodeForm } from './cart-summary';
import { useCartQuote } from './use-cart-quote';

export const CartDrawer = observer(function CartDrawer() {
  const t = useTranslations('cart');
  const tCommon = useTranslations('common');
  const { cart, ui } = useStores();
  const pathname = usePathname();
  const quote = useCartQuote(cart);

  // navigating away (e.g. to checkout) closes the drawer
  useEffect(() => {
    ui.closeCart();
  }, [pathname, ui]);

  return (
    <Dialog
      open={ui.cartOpen}
      onClose={ui.closeCart}
      variant="drawer"
      title={t('title')}
      footer={
        cart.isEmpty ? undefined : (
          <div className={styles.drawerFooter}>
            {quote.data ? <CartSummary quote={quote.data} /> : null}
            <CheckoutButton quote={quote.data} />
          </div>
        )
      }
    >
      {cart.isEmpty ? (
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
      ) : quote.isError && !quote.data ? (
        <ErrorState
          title={t('quoteError')}
          action={<Button onClick={() => void quote.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <CartLines priced={quote.data?.lines} />
          <PromoCodeForm quote={quote.data} />
        </div>
      )}
    </Dialog>
  );
});
