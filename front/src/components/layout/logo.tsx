import Link from 'next/link';
import { BRAND_NAME } from '@/lib/env';
import styles from './layout.module.css';

/** Brand mark: a stylized tonir (clay oven) with a flame + wordmark. */
export function Logo() {
  return (
    <Link href="/" className={styles.logo} aria-label={BRAND_NAME}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        <circle cx="17" cy="17" r="16" fill="var(--color-primary)" />
        <path
          d="M8 22c0-5 4-9 9-9s9 4 9 9"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M17 9c1.8 1.8 2.6 3.3 2.6 4.7a2.6 2.6 0 1 1-5.2 0c0-1 .5-2 1.3-2.8.2 1 .7 1.5 1.3 1.5 0-1.2-.1-2.3 0-3.4Z"
          fill="#ffd8a8"
        />
        <path d="M9 24h16" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className={styles.logoText}>
        Tonir<span className={styles.logoAccent}>Pizza</span>
      </span>
    </Link>
  );
}
