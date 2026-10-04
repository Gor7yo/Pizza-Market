import type {
  AdminProductDto,
  CrustDto,
  IngredientDto,
  ProductCardDto,
  ProductDetailDto,
} from '@market/shared';
import { asLocalized } from '../../common/utils/json';
import type {
  Category,
  Crust,
  Ingredient,
  Prisma,
  Product,
  ProductCrust,
  ProductIngredient,
  ProductSize,
} from '../../generated/prisma/client';
import type { FileStorage } from '../../infrastructure/storage/file-storage';

/** Relations needed to render a product card (and compute "from" price). */
export const productCardInclude = {
  category: { select: { id: true, slug: true } },
  sizes: { select: { priceModifier: true } },
  crusts: {
    where: { crust: { isArchived: false, isAvailable: true } },
    select: { crust: { select: { priceModifier: true } } },
  },
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  category: true,
  sizes: { orderBy: { sizeCm: 'asc' } },
  crusts: { where: { crust: { isArchived: false } }, include: { crust: true } },
  ingredients: {
    where: { ingredient: { isArchived: false } },
    include: { ingredient: true },
    orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
  },
} satisfies Prisma.ProductInclude;

type CardSource = Product & {
  category: Pick<Category, 'id' | 'slug'>;
  sizes: Pick<ProductSize, 'priceModifier'>[];
  crusts: { crust: Pick<Crust, 'priceModifier'> }[];
};

type DetailSource = Product & {
  category: Category;
  sizes: ProductSize[];
  crusts: (ProductCrust & { crust: Crust })[];
  ingredients: (ProductIngredient & { ingredient: Ingredient })[];
};

function min(values: number[]): number {
  return values.length ? Math.min(...values) : 0;
}

/** Cheapest possible configuration price (default extras excluded - they are free). */
export function fromPrice(p: Pick<CardSource, 'basePrice' | 'sizes' | 'crusts'>): number {
  return (
    p.basePrice +
    min(p.sizes.map((s) => s.priceModifier)) +
    min(p.crusts.map((c) => c.crust.priceModifier))
  );
}

export function toCrustDto(c: Crust): CrustDto {
  return {
    id: c.id,
    name: asLocalized(c.name),
    priceModifier: c.priceModifier,
    isAvailable: c.isAvailable,
    sortOrder: c.sortOrder,
  };
}

export function toIngredientDto(i: Ingredient, storage: FileStorage): IngredientDto {
  return {
    id: i.id,
    name: asLocalized(i.name),
    imageUrl: storage.urlOrNull(i.imageKey),
    extraPrice: i.extraPrice,
    isAvailable: i.isAvailable,
  };
}

export function toProductCard(p: CardSource, storage: FileStorage): ProductCardDto {
  return {
    id: p.id,
    slug: p.slug,
    name: asLocalized(p.name),
    description: asLocalized(p.description),
    imageUrl: storage.urlOrNull(p.imageKey),
    categoryId: p.category.id,
    categorySlug: p.category.slug,
    fromPrice: fromPrice(p),
    isConfigurable: p.isConfigurable,
    isAvailable: p.isAvailable,
    tags: p.tags,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
  };
}

export function toProductDetail(p: DetailSource, storage: FileStorage): ProductDetailDto {
  const crusts = [...p.crusts].map((c) => c.crust).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    ...toProductCard(
      { ...p, crusts: crusts.filter((c) => c.isAvailable).map((crust) => ({ crust })) },
      storage,
    ),
    basePrice: p.basePrice,
    sizes: p.sizes.map((s) => ({
      id: s.id,
      sizeCm: s.sizeCm,
      weightGrams: s.weightGrams,
      priceModifier: s.priceModifier,
      isDefault: s.isDefault,
    })),
    crusts: crusts.map(toCrustDto),
    ingredients: p.ingredients.map((pi) => ({
      ingredient: toIngredientDto(pi.ingredient, storage),
      role: pi.role,
      isRemovable: pi.isRemovable,
    })),
    category: { id: p.category.id, slug: p.category.slug, name: asLocalized(p.category.name) },
  };
}

export function toAdminProduct(p: DetailSource, storage: FileStorage): AdminProductDto {
  return {
    ...toProductDetail(p, storage),
    isArchived: p.isArchived,
    sortOrder: p.sortOrder,
    imageKey: p.imageKey,
    updatedAt: p.updatedAt.toISOString(),
  };
}
