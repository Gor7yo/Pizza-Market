'use client';
'use no memo';

import type { ProductCardDto, ProductTag } from '@market/shared';
import { Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/common/product-image';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeTone, Price, Rating } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/feedback';
import { ConfiguratorDialog } from '@/features/configurator/configurator-dialog';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import { useLocalize } from '@/lib/i18n-utils';
import { useStores } from '@/stores/root-store';
import styles from './product-card.module.css';

const TAG_TONES: Record<ProductTag, BadgeTone> = {
  HIT: 'primary',
  NEW: 'info',
  SPICY: 'danger',
  VEGETARIAN: 'accent',
};

export const ProductCard = observer(function ProductCard({
  product,
  priority,
}: {
  product: ProductCardDto;
  priority?: boolean;
}) {
  const t = useTranslations('catalog');
  const tTags = useTranslations('tags');
  const localize = useLocalize();
  const { cart } = useStores();
  const [configuring, setConfiguring] = useState(false);
  const name = localize(product.name);

  const quickAdd = () => {
    if (product.isConfigurable) {
      setConfiguring(true);
      return;
    }
    cart.add({
      productId: product.id,
      sizeId: null,
      crustId: null,
      removedIngredientIds: [],
      extraIngredientIds: [],
    });
    toast.success(t('added', { name }));
  };

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <ProductImage
          src={product.imageUrl}
          alt={name}
          seed={product.slug}
          priority={priority}
          className={styles.image}
          sizes="(min-width: 1200px) 300px, (min-width: 900px) 33vw, 50vw"
        />
        {product.tags.length > 0 ? (
          <div className={styles.tags}>
            {product.tags.map((tag) => (
              <Badge key={tag} tone={TAG_TONES[tag]}>
                {tTags(tag)}
              </Badge>
            ))}
          </div>
        ) : null}
        <FavoriteButton productId={product.id} productName={name} className={styles.favorite} />
        {!product.isAvailable ? <div className={styles.unavailable}>{t('unavailable')}</div> : null}
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>
            <Link href={`/product/${product.slug}`} className={styles.link}>
              {name}
            </Link>
          </h3>
          <Rating value={product.ratingAvg} />
        </div>
        <p className={styles.description}>{localize(product.description)}</p>
        <div className={styles.footer}>
          <div>
            {product.isConfigurable ? <span className={styles.from}>{t('from')} </span> : null}
            <Price amount={product.fromPrice} className={styles.price} />
          </div>
          <Button
            variant={product.isConfigurable ? 'secondary' : 'primary'}
            size="sm"
            className={styles.action}
            onClick={quickAdd}
            disabled={!product.isAvailable}
            aria-label={product.isConfigurable ? t('chooseAria', { name }) : t('addAria', { name })}
          >
            {product.isConfigurable ? (
              t('choose')
            ) : (
              <>
                <Plus size={16} aria-hidden /> {t('add')}
              </>
            )}
          </Button>
        </div>
      </div>
      {configuring ? (
        <ConfiguratorDialog
          slug={product.slug}
          open={configuring}
          onClose={() => setConfiguring(false)}
        />
      ) : null}
    </article>
  );
});

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductCardDto[];
  priorityCount?: number;
}) {
  return (
    <ul className={styles.grid}>
      {products.map((p, i) => (
        <li key={p.id} style={{ display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <ProductCard product={p} priority={i < priorityCount} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className={styles.grid} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.skeletonCard}>
          <Skeleton height="auto" radius={0} className={styles.media} />
          <div className={styles.skeletonBody}>
            <Skeleton width="70%" height={20} />
            <Skeleton width="95%" height={14} />
            <Skeleton width="40%" height={28} />
          </div>
        </li>
      ))}
    </ul>
  );
}
