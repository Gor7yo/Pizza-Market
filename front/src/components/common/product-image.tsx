'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import styles from './product-image.module.css';

/** Real photo shown when a product has no image or its image fails to load. */
export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?auto=format&fit=crop&w=1000&q=80';

/** Local object storage (S3 on localhost) cannot go through the image optimizer. */
function isLocalHost(src: string): boolean {
  try {
    const { hostname } = new URL(src);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Optimized product photo. Falls back to a stock photo, and if even that is
 * unreachable (offline) to a neutral frosted placeholder.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** kept for API compatibility with older call sites */
  seed?: string;
  className?: string;
}) {
  // failures are remembered per URL, so a new `src` (e.g. a fresh upload) is tried again
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const current = src && src !== failedSrc ? src : fallbackFailed ? null : FALLBACK_PRODUCT_IMAGE;

  if (!current) {
    return <span className={cn(styles.placeholder, className)} role="img" aria-label={alt} />;
  }
  return (
    <Image
      key={current}
      src={current}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      style={{ objectFit: 'cover' }}
      unoptimized={isLocalHost(current)}
      onError={() => (current === src ? setFailedSrc(src) : setFallbackFailed(true))}
    />
  );
}
