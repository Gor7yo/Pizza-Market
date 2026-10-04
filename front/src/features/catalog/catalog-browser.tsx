'use client';

import {
  type Paginated,
  PRODUCT_SORTS,
  PRODUCT_TAGS,
  type ProductCardDto,
  type ProductSort,
  type ProductTag,
} from '@market/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, SearchX } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/field';
import { catalogApi } from '@/lib/api/endpoints';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/query/keys';
import styles from './catalog.module.css';
import { ProductGrid, ProductGridSkeleton } from './product-card';

export interface CatalogQuery {
  q?: string;
  category?: string;
  tags: ProductTag[];
  sort: ProductSort;
}

/**
 * Filters live in the URL (shareable, back-button friendly, server-rendered first page);
 * further pages load client-side with an infinite query.
 */
export function CatalogBrowser({
  query,
  initial,
  autoFocusSearch,
}: {
  query: CatalogQuery;
  initial: Paginated<ProductCardDto>;
  autoFocusSearch?: boolean;
}) {
  const t = useTranslations('catalog');
  const tTags = useTranslations('tags');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? '');
  const sentinel = useRef<HTMLDivElement>(null);

  const navigate = (next: Partial<CatalogQuery>) => {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set('q', merged.q);
    if (merged.category) params.set('category', merged.category);
    if (merged.tags.length) params.set('tags', merged.tags.join(','));
    if (merged.sort !== 'popular') params.set('sort', merged.sort);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // debounced search
  useEffect(() => {
    const value = search.trim();
    if (value === (query.q ?? '')) return;
    const id = setTimeout(() => navigate({ q: value || undefined }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is recreated each render
  }, [search]);

  const products = useInfiniteQuery({
    queryKey: qk.products(query),
    queryFn: ({ pageParam }) =>
      catalogApi.products({
        ...query,
        tags: query.tags.length ? query.tags : undefined,
        page: pageParam,
        pageSize: initial.pageSize,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData: { pages: [initial], pageParams: [1] },
  });

  // infinite loading when the sentinel becomes visible
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !products.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !products.isFetchingNextPage)
          void products.fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [products]);

  const items = products.data.pages.flatMap((p) => p.items);
  const total = products.data.pages[0]?.total ?? 0;

  const toggleTag = (tag: ProductTag) =>
    navigate({
      tags: query.tags.includes(tag) ? query.tags.filter((x) => x !== tag) : [...query.tags, tag],
    });

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.search} role="search">
          <Search size={18} className={styles.searchIcon} aria-hidden />
          <label htmlFor="catalog-search" className="visually-hidden">
            {t('searchLabel')}
          </label>
          <Input
            id="catalog-search"
            type="search"
            className={styles.searchInput}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus={autoFocusSearch}
            maxLength={100}
          />
        </div>
        <div className={styles.filters}>
          <label htmlFor="catalog-sort" className="visually-hidden">
            {t('sortLabel')}
          </label>
          <Select
            id="catalog-sort"
            className={styles.sort}
            value={query.sort}
            onChange={(e) => navigate({ sort: e.target.value as ProductSort })}
          >
            {PRODUCT_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </Select>
          {PRODUCT_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              aria-pressed={query.tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tTags(tag)}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.count} aria-live="polite">
        {t('found', { count: total })}
      </p>

      <div className={cn(styles.results, pending && styles.pending)} aria-busy={pending}>
        {products.isError && items.length === 0 ? (
          <ErrorState
            title={t('loadError')}
            action={<Button onClick={() => void products.refetch()}>{tCommon('retry')}</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('emptyTitle')}
            text={t('emptyText')}
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  navigate({ q: undefined, tags: [], category: undefined, sort: 'popular' });
                }}
              >
                {t('resetFilters')}
              </Button>
            }
          />
        ) : (
          <ProductGrid products={items} priorityCount={4} />
        )}
      </div>

      {products.isFetchingNextPage ? (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <ProductGridSkeleton count={4} />
        </div>
      ) : null}
      <div ref={sentinel} />
      {products.hasNextPage && !products.isFetchingNextPage ? (
        <div className={styles.more}>
          <Button onClick={() => void products.fetchNextPage()}>{t('loadMore')}</Button>
        </div>
      ) : null}
    </div>
  );
}
