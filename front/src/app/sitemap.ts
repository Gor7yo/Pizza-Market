import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api/server';
import { SITE_URL } from '@/lib/env';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/menu`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ];
  try {
    const entries = await serverApi<{
      products: { slug: string; updatedAt: string }[];
      categories: string[];
    }>('/sitemap-entries', { revalidate: 3600 });
    return [
      ...base,
      ...entries.categories.map((slug) => ({
        url: `${SITE_URL}/menu?category=${slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...entries.products.map((p) => ({
        url: `${SITE_URL}/product/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return base;
  }
}
