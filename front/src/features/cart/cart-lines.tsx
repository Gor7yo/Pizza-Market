'use client';
'use no memo';

import type { PricedCartLineDto } from '@market/shared';
import { observer } from 'mobx-react-lite';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProductImage } from '@/components/common/product-image';
import { Price, QuantityStepper } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/feedback';
import { ConfiguratorDialog } from '@/features/configurator/configurator-dialog';
import { useLocalize } from '@/lib/i18n-utils';
import type { CartLine } from '@/stores/cart.store';
import { useStores } from '@/stores/root-store';
import styles from './cart.module.css';

/** Cart lines: configuration from MobX, names/prices from the server quote. */
export const CartLines = observer(function CartLines({
  priced,
}: {
  priced: PricedCartLineDto[] | undefined;
}) {
  const { cart } = useStores();
  const byKey = new Map((priced ?? []).map((l) => [l.key, l]));
  return (
    <ul className={styles.lines}>
      {cart.lines.map((line) => (
        <CartLineRow key={line.key} line={line} priced={byKey.get(line.key)} />
      ))}
    </ul>
  );
});

const CartLineRow = observer(function CartLineRow({
  line,
  priced,
}: {
  line: CartLine;
  priced?: PricedCartLineDto;
}) {
  const t = useTranslations('cart');
  const tErrors = useTranslations('errors');
  const tConf = useTranslations('configurator');
  const localize = useLocalize();
  const { cart } = useStores();
  const [editing, setEditing] = useState(false);

  if (!priced) {
    return (
      <li className={styles.line} aria-busy>
        <Skeleton width={72} height={72} radius="var(--radius-md)" />
        <div className={styles.info}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="80%" height={14} />
        </div>
      </li>
    );
  }

  const name = localize(priced.name);
  const details = [
    priced.sizeCm ? tConf('cm', { cm: priced.sizeCm }) : null,
    priced.crustName ? localize(priced.crustName) : null,
    ...priced.extraIngredients.map((e) => `+ ${localize(e.name)}`),
    ...priced.removedIngredients.map((r) => `− ${localize(r.name)}`),
  ].filter(Boolean);

  return (
    <li className={styles.line}>
      <div className={styles.thumb}>
        <ProductImage
          src={priced.imageUrl}
          alt=""
          seed={priced.productSlug || priced.productId}
          sizes="72px"
        />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {details.length > 0 ? <span className={styles.details}>{details.join(', ')}</span> : null}
        {!priced.available ? (
          <span className={styles.unavailable} role="status">
            {tErrors(priced.unavailableReason ?? 'PRODUCT_UNAVAILABLE')}
          </span>
        ) : null}
        <div className={styles.lineFooter}>
          <QuantityStepper
            value={line.quantity}
            min={0}
            onChange={(q) => cart.setQuantity(line.key, q)}
            label={t('quantityOf', { name })}
          />
          {priced.available ? <Price amount={priced.lineTotal} /> : null}
        </div>
        <div className={styles.lineActions}>
          {priced.available && priced.sizeId ? (
            <button type="button" className={styles.textButton} onClick={() => setEditing(true)}>
              {t('edit')}
            </button>
          ) : null}
          {priced.available ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => cart.duplicate(line.key)}
            >
              {t('oneMore')}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.textButton}
            onClick={() => cart.remove(line.key)}
            aria-label={t('removeAria', { name })}
          >
            {t('remove')}
          </button>
        </div>
      </div>
      {editing && priced.productSlug ? (
        <ConfiguratorDialog
          slug={priced.productSlug}
          open={editing}
          onClose={() => setEditing(false)}
          edit={{ key: line.key, initial: line }}
        />
      ) : null}
    </li>
  );
});
