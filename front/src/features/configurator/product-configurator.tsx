'use client';
'use no memo';

import type { CartItemInput, ProductDetailDto } from '@market/shared';
import { Check } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/common/product-image';
import { Button } from '@/components/ui/button';
import { QuantityStepper, SegmentedControl } from '@/components/ui/controls';
import { useLocalize } from '@/lib/i18n-utils';
import { useMoney } from '@/lib/money';
import { ConfiguratorStore } from '@/stores/configurator.store';
import { useStores } from '@/stores/root-store';
import styles from './configurator.module.css';

interface Props {
  product: ProductDetailDto;
  /** Edit an existing cart line instead of adding a new one */
  edit?: { key: string; initial: CartItemInput };
  onDone?: () => void;
  imagePriority?: boolean;
}

const SIZE_SCALE = [0.86, 0.94, 1];

export const ProductConfigurator = observer(function ProductConfigurator({
  product,
  edit,
  onDone,
  imagePriority,
}: Props) {
  const t = useTranslations('configurator');
  const localize = useLocalize();
  const { format } = useMoney();
  const { cart } = useStores();
  const [store] = useState(() => new ConfiguratorStore(product, edit?.initial));
  const name = localize(product.name);

  const sizeIndex = product.sizes.findIndex((s) => s.id === store.sizeId);
  const scale = sizeIndex >= 0 ? (SIZE_SCALE[Math.min(sizeIndex, SIZE_SCALE.length - 1)] ?? 1) : 1;

  const submit = () => {
    if (!store.isValid) return;
    if (edit) {
      cart.replace(edit.key, store.config, store.quantity);
      toast.success(t('updated', { name }));
    } else {
      cart.add(store.config, store.quantity);
      toast.success(t('added', { name }));
    }
    onDone?.();
  };

  return (
    <div className={styles.layout}>
      <div className={styles.visual}>
        <div className={styles.visualInner} style={{ transform: `scale(${scale})` }}>
          <ProductImage
            src={product.imageUrl}
            alt={name}
            seed={product.slug}
            priority={imagePriority}
            sizes="(min-width: 900px) 480px, 100vw"
          />
        </div>
      </div>

      <div className={styles.panel}>
        <div>
          <h2 className={styles.title}>{name}</h2>
          {store.size ? (
            <p className={styles.meta}>
              {t('sizeMeta', { cm: store.size.sizeCm, grams: store.size.weightGrams ?? 0 })}
              {store.crust ? ` · ${localize(store.crust.name)}` : ''}
            </p>
          ) : null}
        </div>
        <p className={styles.description}>{localize(product.description)}</p>

        {product.sizes.length > 0 ? (
          <div className={styles.section}>
            <SegmentedControl
              name={`size-${product.id}`}
              legend={t('size')}
              value={store.sizeId}
              onChange={store.setSize}
              options={product.sizes.map((s) => ({
                value: s.id,
                label: t('cm', { cm: s.sizeCm }),
              }))}
            />
          </div>
        ) : null}

        {product.crusts.length > 0 ? (
          <div className={styles.section}>
            <SegmentedControl
              name={`crust-${product.id}`}
              legend={t('crust')}
              value={store.crustId}
              onChange={store.setCrust}
              options={product.crusts.map((c) => ({
                value: c.id,
                disabled: !c.isAvailable,
                label:
                  c.priceModifier > 0
                    ? `${localize(c.name)} +${format(c.priceModifier)}`
                    : localize(c.name),
              }))}
            />
          </div>
        ) : null}

        {store.defaultIngredients.length > 0 ? (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('composition')}</h3>
            <div className={styles.chips}>
              {store.defaultIngredients.map(({ ingredient, isRemovable }) => {
                const removed = store.removed.has(ingredient.id);
                const label = localize(ingredient.name);
                return (
                  <button
                    key={ingredient.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={removed}
                    disabled={!isRemovable}
                    aria-label={
                      isRemovable
                        ? removed
                          ? t('returnIngredient', { name: label })
                          : t('removeIngredient', { name: label })
                        : label
                    }
                    onClick={() => store.toggleRemoved(ingredient.id)}
                  >
                    {label}
                    {isRemovable ? <span aria-hidden>{removed ? '↺' : '×'}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {store.extraIngredients.length > 0 ? (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('extras')}</h3>
            <div className={styles.extras}>
              {store.extraIngredients.map(({ ingredient }) => {
                const selected = store.extras.has(ingredient.id);
                const label = localize(ingredient.name);
                return (
                  <button
                    key={ingredient.id}
                    type="button"
                    className={styles.extra}
                    aria-pressed={selected}
                    disabled={!ingredient.isAvailable}
                    onClick={() => store.toggleExtra(ingredient.id)}
                  >
                    {selected ? (
                      <Check size={16} className={styles.extraCheck} aria-hidden />
                    ) : null}
                    <span>{label}</span>
                    <span className={styles.extraPrice}>+{format(ingredient.extraPrice)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={styles.footer}>
          <QuantityStepper
            value={store.quantity}
            onChange={store.setQuantity}
            label={t('quantity')}
          />
          <Button
            variant="primary"
            size="lg"
            className={styles.addButton}
            disabled={!store.isValid}
            onClick={submit}
          >
            {edit ? t('save') : t('addFor')}{' '}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={store.total}
                className={styles.priceValue}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {format(store.total)}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
        {!product.isAvailable ? <p className={styles.note}>{t('unavailable')}</p> : null}
      </div>
    </div>
  );
});
