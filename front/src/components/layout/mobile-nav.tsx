'use client';
'use no memo';

import { Home, Package, ShoppingBag, User } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/use-session';
import { useStores } from '@/stores/root-store';
import styles from './layout.module.css';

/** Thumb-friendly bottom navigation on phones. */
export const MobileNav = observer(function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { cart, ui } = useStores();
  const { user } = useSession();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className={styles.mobileNav} aria-label={t('mobile')}>
      <Link
        href="/"
        className={styles.mobileNavLink}
        aria-current={isActive('/') ? 'page' : undefined}
      >
        <Home size={22} aria-hidden />
        {t('home')}
      </Link>
      <button
        type="button"
        className={styles.mobileNavLink}
        style={{ border: 'none', background: 'transparent' }}
        onClick={ui.openCart}
        aria-label={t('cartWithCount', { count: cart.hydrated ? cart.count : 0 })}
      >
        <ShoppingBag size={22} aria-hidden />
        {t('cart')}
        {cart.hydrated && cart.count > 0 ? (
          <span className={styles.mobileBadge} aria-hidden>
            {cart.count}
          </span>
        ) : null}
      </button>
      <Link
        href="/orders"
        className={styles.mobileNavLink}
        aria-current={isActive('/orders') ? 'page' : undefined}
      >
        <Package size={22} aria-hidden />
        {t('orders')}
      </Link>
      <Link
        href={user ? '/account' : '/login'}
        className={styles.mobileNavLink}
        aria-current={isActive('/account') ? 'page' : undefined}
      >
        <User size={22} aria-hidden />
        {user ? t('profile') : t('login')}
      </Link>
    </nav>
  );
});
