import { type CategoryDto, type Locale, localize } from '@market/shared';
import Link from 'next/link';
import { DEFAULT_LOCALE } from '@/lib/env';
import styles from './home.module.css';

/** Horizontally scrollable, sticky category navigation (server-rendered links). */
export function CategoryChips({
  categories,
  active,
  locale,
  allLabel,
  label,
}: {
  categories: CategoryDto[];
  active?: string;
  locale: Locale;
  allLabel: string;
  label: string;
}) {
  return (
    <nav className={styles.categories} aria-label={label}>
      <div className={`container ${styles.chips}`}>
        <Link href="/menu" className={styles.chip} aria-current={!active ? 'true' : undefined}>
          {allLabel}
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/menu?category=${c.slug}`}
            className={styles.chip}
            aria-current={active === c.slug ? 'true' : undefined}
          >
            {localize(c.name, locale, DEFAULT_LOCALE)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
