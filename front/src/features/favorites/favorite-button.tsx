'use client';

import { Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import styles from './favorites.module.css';
import { useFavorites } from './use-favorites';

export function FavoriteButton({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const t = useTranslations('favorites');
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(productId);

  return (
    <button
      type="button"
      className={cn(styles.button, active && styles.active, className)}
      aria-pressed={active}
      aria-label={active ? t('remove', { name: productName }) : t('add', { name: productName })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
    >
      <motion.span
        key={String(active)}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        style={{ display: 'grid' }}
      >
        <Heart size={20} fill={active ? 'currentColor' : 'none'} aria-hidden />
      </motion.span>
    </button>
  );
}
