'use client';
'use no memo';

import { Heart, Search, ShoppingBag, User } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/use-session';
import { useStores } from '@/stores/root-store';
import styles from './layout.module.css';
import { Logo } from './logo';
import { UserMenu } from './user-menu';

const NAV = [
  { href: '/menu', key: 'menu' },
  { href: '/menu?category=pizza', key: 'pizza' },
  { href: '/orders', key: 'orders' },
] as const;

export const Header = observer(function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { cart, ui } = useStores();
  const { user } = useSession();

  return (
    <header className={styles.header}>
      <div className="container">
        <div className={styles.headerInner}>
          <Logo />
          <nav className={styles.nav} aria-label={t('main')}>
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={styles.navLink}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <div className={styles.actions}>
            <Button href="/menu?focus=search" variant="ghost" iconOnly aria-label={t('search')}>
              <Search size={20} aria-hidden />
            </Button>
            <span className={styles.desktopOnly}>
              <Button href="/favorites" variant="ghost" iconOnly aria-label={t('favorites')}>
                <Heart size={20} aria-hidden />
              </Button>
            </span>
            <span className={styles.desktopOnly}>
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Button href="/login" variant="ghost" size="sm">
                  <User size={18} aria-hidden />
                  {t('login')}
                </Button>
              )}
            </span>
            <Button
              variant="primary"
              className={styles.cartButton}
              onClick={ui.openCart}
              aria-label={t('cartWithCount', { count: cart.hydrated ? cart.count : 0 })}
            >
              <ShoppingBag size={18} aria-hidden />
              <span className={styles.desktopOnly}>{t('cart')}</span>
              {cart.hydrated && cart.count > 0 ? (
                <span className={styles.cartCount} aria-hidden>
                  {cart.count}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
});
