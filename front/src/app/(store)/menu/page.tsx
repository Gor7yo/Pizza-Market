import {
  type CategoryDto,
  type Locale,
  localize,
  type Paginated,
  PRODUCT_SORTS,
  PRODUCT_TAGS,
  type ProductCardDto,
  type ProductSort,
  type ProductTag,
} from '@market/shared';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ErrorState } from '@/components/ui/feedback';
import { CatalogBrowser, type CatalogQuery } from '@/features/catalog/catalog-browser';
import styles from '@/features/catalog/catalog.module.css';
import { CategoryChips } from '@/features/catalog/category-chips';
import { serverApi } from '@/lib/api/server';
import { DEFAULT_LOCALE } from '@/lib/env';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseQuery(params: Record<string, string | string[] | undefined>): CatalogQuery {
  const sort = first(params.sort);
  const tags = (first(params.tags) ?? '')
    .split(',')
    .filter((t): t is ProductTag => (PRODUCT_TAGS as readonly string[]).includes(t));
  const category = first(params.category);
  return {
    q: first(params.q)?.slice(0, 100) || undefined,
    category: category && /^[a-z0-9-]{1,80}$/.test(category) ? category : undefined,
    tags,
    sort: (PRODUCT_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ProductSort)
      : 'popular',
  };
}

function toApiQuery(q: CatalogQuery): string {
  const params = new URLSearchParams({ sort: q.sort, pageSize: '24' });
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', q.category);
  if (q.tags.length) params.set('tags', q.tags.join(','));
  return params.toString();
}

async function loadCategories(): Promise<CategoryDto[]> {
  return serverApi<CategoryDto[]>('/categories', { revalidate: 300, tags: ['catalog'] }).catch(
    () => [],
  );
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const t = await getTranslations('catalog');
  const locale = (await getLocale()) as Locale;
  const query = parseQuery(await searchParams);
  const category = query.category
    ? (await loadCategories()).find((c) => c.slug === query.category)
    : undefined;
  const title = category ? localize(category.name, locale, DEFAULT_LOCALE) : t('title');
  return {
    title,
    description: t('metaDescription'),
    alternates: { canonical: category ? `/menu?category=${category.slug}` : '/menu' },
    // search results and filter combinations should not be indexed
    robots: query.q || query.tags.length ? { index: false, follow: true } : undefined,
  };
}

export default async function MenuPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('catalog');
  const tHome = await getTranslations('home');
  const locale = (await getLocale()) as Locale;
  const params = await searchParams;
  const query = parseQuery(params);

  const [categories, initial] = await Promise.all([
    loadCategories(),
    serverApi<Paginated<ProductCardDto>>(`/products?${toApiQuery(query)}`, {
      revalidate: 60,
      tags: ['catalog'],
    }).catch(() => null),
  ]);
  const category = categories.find((c) => c.slug === query.category);

  return (
    <>
      <CategoryChips
        categories={categories}
        active={query.category}
        locale={locale}
        allLabel={tHome('all')}
        label={tHome('categories')}
      />
      <div className={`container ${styles.page}`}>
        <div className={styles.heading}>
          <h1 className={styles.title}>
            {category ? localize(category.name, locale, DEFAULT_LOCALE) : t('title')}
          </h1>
        </div>
        {initial ? (
          <CatalogBrowser
            // remount on filter changes, but not while typing (keeps input focus)
            key={JSON.stringify({ ...query, q: undefined })}
            query={query}
            initial={initial}
            autoFocusSearch={first(params.focus) === 'search'}
          />
        ) : (
          <ErrorState title={t('loadError')} text={tHome('loadErrorText')} />
        )}
      </div>
    </>
  );
}
