import { Injectable } from '@nestjs/common';
import type {
  CategoryDto,
  Paginated,
  ProductCardDto,
  ProductDetailDto,
  productListQuerySchema,
} from '@market/shared';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app.exception';
import { asLocalized } from '../../common/utils/json';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import {
  productCardInclude,
  productDetailInclude,
  toProductCard,
  toProductDetail,
} from './catalog.mapper';

const VISIBLE_PRODUCT: Prisma.ProductWhereInput = {
  isArchived: false,
  category: { isArchived: false, isActive: true },
};

const SORTS: Record<
  z.output<typeof productListQuerySchema>['sort'],
  Prisma.ProductOrderByWithRelationInput[]
> = {
  popular: [{ soldCount: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
  price_asc: [{ basePrice: 'asc' }, { sortOrder: 'asc' }],
  price_desc: [{ basePrice: 'desc' }, { sortOrder: 'asc' }],
  rating: [{ ratingAvg: { sort: 'desc', nulls: 'last' } }, { ratingCount: 'desc' }],
  newest: [{ createdAt: 'desc' }],
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { isArchived: false, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { products: { where: { isArchived: false } } } } },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: asLocalized(c.name),
      sortOrder: c.sortOrder,
      productCount: c._count.products,
    }));
  }

  async products(
    query: z.output<typeof productListQuerySchema>,
  ): Promise<Paginated<ProductCardDto>> {
    const where: Prisma.ProductWhereInput = {
      ...VISIBLE_PRODUCT,
      category: { isArchived: false, isActive: true, slug: query.category },
      tags: query.tags?.length ? { hasEvery: query.tags } : undefined,
      searchText: query.q ? { contains: query.q.toLowerCase() } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: SORTS[query.sort],
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(
      rows.map((p) => toProductCard(p, this.storage)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async productBySlug(slug: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { ...VISIBLE_PRODUCT, slug },
      include: productDetailInclude,
    });
    if (!product) throw AppException.notFound('Product');
    return toProductDetail(product, this.storage);
  }

  async productsByIds(ids: string[]): Promise<ProductCardDto[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { ...VISIBLE_PRODUCT, id: { in: ids } },
      include: productCardInclude,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const p = byId.get(id);
      return p ? [toProductCard(p, this.storage)] : [];
    });
  }

  /** Slugs + update dates for the sitemap. */
  async sitemapEntries(): Promise<{
    products: { slug: string; updatedAt: string }[];
    categories: string[];
  }> {
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: VISIBLE_PRODUCT,
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.category.findMany({
        where: { isArchived: false, isActive: true },
        select: { slug: true },
      }),
    ]);
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
      categories: categories.map((c) => c.slug),
    };
  }
}
