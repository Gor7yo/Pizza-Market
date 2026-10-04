import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BRAND_NAME } from '@/lib/env';
import styles from './layout.module.css';
import { CurrencySwitcher, LocaleSwitcher } from './preferences';

export async function Footer({
  supportPhone,
  pickupAddress,
}: {
  supportPhone?: string;
  pickupAddress?: string;
}) {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          <div>
            <p className={styles.footerTitle}>{BRAND_NAME}</p>
            <p>{t('tagline')}</p>
            {pickupAddress ? <p style={{ marginTop: 'var(--space-3)' }}>{pickupAddress}</p> : null}
            {supportPhone ? (
              <p>
                <a href={`tel:${supportPhone.replace(/\s/g, '')}`}>{supportPhone}</a>
              </p>
            ) : null}
          </div>
          <div>
            <p className={styles.footerTitle}>{t('shop')}</p>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/menu">{t('menu')}</Link>
              </li>
              <li>
                <Link href="/favorites">{t('favorites')}</Link>
              </li>
              <li>
                <Link href="/cart">{t('cart')}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className={styles.footerTitle}>{t('account')}</p>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/account">{t('profile')}</Link>
              </li>
              <li>
                <Link href="/orders">{t('orders')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {year} {BRAND_NAME}. {t('rights')}
          </span>
          <div className={styles.prefs}>
            <LocaleSwitcher />
            <CurrencySwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
