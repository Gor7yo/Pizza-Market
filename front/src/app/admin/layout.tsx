import type { UserDto } from '@market/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/features/admin/admin-nav';
import styles from '@/features/admin/admin.module.css';
import { serverApiOptional } from '@/lib/api/server';
import { BRAND_NAME } from '@/lib/env';

export const metadata: Metadata = {
  title: { default: 'Admin', template: `%s · Admin · ${BRAND_NAME}` },
  robots: { index: false, follow: false },
};

/**
 * Server-side gate: nothing of the admin UI is rendered before the API confirms
 * the ADMIN role. Every admin API call is authorized again by the API itself.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await serverApiOptional<UserDto>('/auth/me', { auth: true }).catch(() => null);
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/');

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span>{BRAND_NAME}</span>
          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>{user.email}</span>
        </div>
        <AdminNav />
      </aside>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
