import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import styles from '@/features/profile/account.module.css';
import { AccountNav } from '@/features/profile/account-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`container ${styles.layout}`}>
      <AccountNav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
