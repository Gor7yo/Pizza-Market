'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './account.module.css';

const LINKS = [
  { href: '/account', key: 'profile' },
  { href: '/account/addresses', key: 'addresses' },
  { href: '/account/security', key: 'security' },
  { href: '/orders', key: 'orders' },
  { href: '/favorites', key: 'favorites' },
] as const;

export function AccountNav() {
  const t = useTranslations('account');
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label={t('navLabel')}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={styles.navLink}
          aria-current={pathname === l.href ? 'page' : undefined}
        >
          {t(`nav.${l.key}`)}
        </Link>
      ))}
    </nav>
  );
}
