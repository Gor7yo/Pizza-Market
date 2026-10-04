import type { CategoryDto, Locale, Paginated, ProductCardDto } from '@market/shared';
import { Clock, Flame, Leaf, Sparkles, Truck } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ProductImage } from '@/components/common/product-image';
import { StoreShell } from '@/components/layout/store-shell';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { CategoryChips } from '@/features/catalog/category-chips';
import styles from '@/features/catalog/home.module.css';
import { ProductGrid } from '@/features/catalog/product-card';
import { serverApi } from '@/lib/api/server';
import { BRAND_NAME, SITE_URL } from '@/lib/env';

async function loadHome() {
  try {
    const [categories, popular, fresh] = await Promise.all([
      serverApi<CategoryDto[]>('/categories', { revalidate: 300, tags: ['catalog'] }),
      serverApi<Paginated<ProductCardDto>>('/products?sort=popular&pageSize=8', {
        revalidate: 60,
        tags: ['catalog'],
      }),
      serverApi<Paginated<ProductCardDto>>('/products?tags=NEW&sort=newest&pageSize=4', {
        revalidate: 60,
        tags: ['catalog'],
      }),
    ]);
    return { categories, popular: popular.items, fresh: fresh.items };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const locale = (await getLocale()) as Locale;
  const data = await loadHome();
  const heroProduct = data?.popular.find((p) => p.imageUrl) ?? data?.popular[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: BRAND_NAME,
    url: SITE_URL,
    servesCuisine: ['Pizza', 'Armenian'],
    address: { '@type': 'PostalAddress', addressLocality: 'Yerevan', addressCountry: 'AM' },
    hasMenu: `${SITE_URL}/menu`,
  };

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <span className={styles.eyebrow}>
              <Flame size={16} aria-hidden /> {t('eyebrow')}
            </span>
            <h1 className={styles.heroTitle}>
              {t.rich('title', { em: (chunks) => <em>{chunks}</em> })}
            </h1>
            <p className={styles.heroText}>{t('subtitle')}</p>
            <div className={styles.heroActions}>
              <Button href="/menu?category=pizza" variant="primary" size="lg">
                {t('cta')}
              </Button>
              <Button href="/menu" variant="outline" size="lg">
                {t('ctaSecondary')}
              </Button>
            </div>
          </div>
          <div className={styles.heroVisual} aria-hidden>
            <div className={styles.heroGlow} />
            <div className={styles.heroPlate}>
              <ProductImage
                src={heroProduct?.imageUrl ?? null}
                alt=""
                seed={heroProduct?.slug ?? 'hero'}
                priority
                sizes="(min-width: 900px) 520px, 90vw"
              />
            </div>
            <span className={`${styles.floatBadge} ${styles.badgeTop}`}>
              <Clock size={18} aria-hidden /> {t('badgeTime')}
            </span>
            <span className={`${styles.floatBadge} ${styles.badgeBottom}`}>
              <Flame size={18} aria-hidden /> {t('badgeOven')}
            </span>
          </div>
        </div>
      </section>

      {data ? (
        <>
          <CategoryChips
            categories={data.categories}
            locale={locale}
            allLabel={t('all')}
            label={t('categories')}
          />

          <section className={`container ${styles.section}`} aria-labelledby="popular-title">
            <div className={styles.sectionHeader}>
              <h2 id="popular-title" className={styles.sectionTitle}>
                {t('popular')}
              </h2>
              <Link href="/menu" className={styles.sectionLink}>
                {t('seeAll')}
              </Link>
            </div>
            <ProductGrid products={data.popular} priorityCount={2} />
          </section>

          <section className={`container ${styles.section}`}>
            <div className={styles.promo}>
              <div>
                <h2 className={styles.promoTitle}>{t('promoTitle')}</h2>
                <p>{t('promoText')}</p>
                <span className={styles.promoCode}>WELCOME10</span>
              </div>
              <Button href="/menu?category=pizza" size="lg">
                {t('cta')}
              </Button>
            </div>
          </section>

          {data.fresh.length > 0 ? (
            <section className={`container ${styles.section}`} aria-labelledby="new-title">
              <div className={styles.sectionHeader}>
                <h2 id="new-title" className={styles.sectionTitle}>
                  {t('new')}
                </h2>
              </div>
              <ProductGrid products={data.fresh} />
            </section>
          ) : null}
        </>
      ) : (
        <div className="container">
          <ErrorState title={t('loadError')} text={t('loadErrorText')} />
        </div>
      )}

      <section className={`container ${styles.section}`} aria-label={t('benefitsLabel')}>
        <div className={styles.benefits}>
          {[
            { icon: Truck, title: t('benefit1Title'), text: t('benefit1Text') },
            { icon: Leaf, title: t('benefit2Title'), text: t('benefit2Text') },
            { icon: Sparkles, title: t('benefit3Title'), text: t('benefit3Text') },
          ].map((b) => (
            <div key={b.title} className={styles.benefit}>
              <span className={styles.benefitIcon} aria-hidden>
                <b.icon size={24} />
              </span>
              <div>
                <h3 className={styles.benefitTitle}>{b.title}</h3>
                <p className={styles.benefitText}>{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
