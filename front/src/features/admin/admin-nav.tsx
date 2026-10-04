'use client';

import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MessageSquare,
  Pizza,
  ScrollText,
  Settings,
  Store,
  Tag,
  Users,
  Wheat,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './admin.module.css';

const LINKS = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', key: 'orders', icon: ClipboardList },
  { href: '/admin/products', key: 'products', icon: Pizza },
  { href: '/admin/categories', key: 'categories', icon: FolderTree },
  { href: '/admin/ingredients', key: 'ingredients', icon: Wheat },
  { href: '/admin/promo-codes', key: 'promo', icon: Tag },
  { href: '/admin/reviews', key: 'reviews', icon: MessageSquare },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/audit-logs', key: 'audit', icon: ScrollText },
  { href: '/admin/settings', key: 'settings', icon: Settings },
] as const;

export function AdminNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <nav className={styles.nav} aria-label={t('label')}>
        {LINKS.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={styles.navLink}
            aria-current={isActive(href) ? 'page' : undefined}
          >
            <Icon size={18} aria-hidden /> {t(key)}
          </Link>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <Link href="/" className={styles.navLink}>
          <Store size={18} aria-hidden /> {t('store')}
        </Link>
      </div>
    </>
  );
}
