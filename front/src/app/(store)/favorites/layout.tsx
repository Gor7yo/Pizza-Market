import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('favorites');
  return { title: t('title'), robots: { index: false, follow: true } };
}

export default function FavoritesLayout({ children }: { children: ReactNode }) {
  return children;
}
