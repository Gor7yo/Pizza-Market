import type { StoreSettingsDto } from '@market/shared';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { CartDrawer } from '@/features/cart/cart-drawer';
import { serverApiOptional } from '@/lib/api/server';
import { Footer } from './footer';
import { Header } from './header';
import styles from './layout.module.css';
import { MobileNav } from './mobile-nav';

/** Storefront chrome shared by every public page. */
export async function StoreShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('common');
  const settings = await serverApiOptional<StoreSettingsDto>('/settings', { revalidate: 60 }).catch(
    () => null,
  );

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        {t('skipToContent')}
      </a>
      <Header />
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <Footer supportPhone={settings?.supportPhone} pickupAddress={settings?.pickupAddress} />
      <MobileNav />
      <CartDrawer />
    </div>
  );
}
