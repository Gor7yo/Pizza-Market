import {
  formatMinorToMajor,
  type Locale,
  localize,
  type ProductDetailDto,
  type StoreSettingsDto,
} from '@market/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { ProductConfigurator } from '@/features/configurator/product-configurator';
import { ProductReviews } from '@/features/reviews/product-reviews';
import { ApiError } from '@/lib/api/errors';
import { serverApi, serverApiOptional } from '@/lib/api/server';
import { DEFAULT_LOCALE, SITE_URL } from '@/lib/env';
import styles from './product.module.css';

type Params = Promise<{ slug: string }>;

/** Deduplicated between generateMetadata and the page within one request. */
const loadProduct = cache(async (slug: string): Promise<ProductDetailDto | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    return await serverApi<ProductDetailDto>(`/products/${slug}`, {
      revalidate: 60,
      tags: ['catalog', `product:${slug}`],
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return {};
  const locale = (await getLocale()) as Locale;
  const name = localize(product.name, locale, DEFAULT_LOCALE);
  const description = localize(product.description, locale, DEFAULT_LOCALE);
  return {
    title: name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: name,
      description,
      type: 'website',
      url: `/product/${product.slug}`,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const t = await getTranslations('product');
  const locale = (await getLocale()) as Locale;
  const settings = await serverApiOptional<StoreSettingsDto>('/settings', { revalidate: 60 }).catch(
    () => null,
  );
  const name = localize(product.name, locale, DEFAULT_LOCALE);
  const currency = settings?.currency ?? 'AMD';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: localize(product.description, locale, DEFAULT_LOCALE),
    image: product.imageUrl ? [product.imageUrl] : undefined,
    category: localize(product.category.name, locale, DEFAULT_LOCALE),
    url: `${SITE_URL}/product/${product.slug}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price: formatMinorToMajor(product.fromPrice, currency),
      availability: product.isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    aggregateRating:
      product.ratingAvg !== null && product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg,
            reviewCount: product.ratingCount,
          }
        : undefined,
  };

  return (
    <div className={`container ${styles.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label={t('breadcrumbs')} className={styles.breadcrumbs}>
        <ol>
          <li>
            <Link href="/menu">{t('menu')}</Link>
          </li>
          <li>
            <Link href={`/menu?category=${product.category.slug}`}>
              {localize(product.category.name, locale, DEFAULT_LOCALE)}
            </Link>
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>
      <h1 className="visually-hidden">{name}</h1>
      <ProductConfigurator product={product} imagePriority />
      <ProductReviews productId={product.id} />
    </div>
  );
}
