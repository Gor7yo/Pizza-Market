import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/layout/logo';
import { LocaleSwitcher } from '@/components/layout/preferences';
import styles from '@/features/auth/auth.module.css';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className={styles.shell}>
      <aside className={styles.aside} aria-hidden>
        <h2 className={styles.asideTitle}>{t('asideTitle')}</h2>
        <p className={styles.asideText}>{t('asideText')}</p>
      </aside>
      <div className={styles.content}>
        <div className={styles.top}>
          <Logo />
          <LocaleSwitcher className="" />
        </div>
        <main className={styles.formWrap}>{children}</main>
      </div>
    </div>
  );
}
