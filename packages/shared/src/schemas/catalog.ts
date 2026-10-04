import { z } from 'zod';
import {
  csvArray,
  idSchema,
  localizedTextSchema,
  moneySchema,
  optionalLocalizedTextSchema,
  paginationQuerySchema,
  slugSchema,
  V,
} from './common';

export const PRODUCT_TAGS = ['HIT', 'NEW', 'SPICY', 'VEGETARIAN'] as const;
export type ProductTag = (typeof PRODUCT_TAGS)[number];

export const PRODUCT_SORTS = ['popular', 'price_asc', 'price_desc', 'rating', 'newest'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const INGREDIENT_ROLES = ['DEFAULT', 'EXTRA'] as const;
export type IngredientRole = (typeof INGREDIENT_ROLES)[number];

export const productListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  category: slugSchema.optional(),
  tags: csvArray(z.enum(PRODUCT_TAGS)),
  sort: z.enum(PRODUCT_SORTS).default('popular'),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type ProductListQuery = z.input<typeof productListQuerySchema>;

export const productSizeInputSchema = z.strictObject({
  id: idSchema.optional(),
  sizeCm: z.number().int().min(10, V.invalid).max(80, V.invalid),
  weightGrams: z.number().int().min(1).max(10_000).nullable().optional(),
  priceModifier: moneySchema,
  isDefault: z.boolean().default(false),
});

export const productIngredientInputSchema = z.strictObject({
  ingredientId: idSchema,
  role: z.enum(INGREDIENT_ROLES),
  isRemovable: z.boolean().default(true),
});

export const productInputSchema = z
  .strictObject({
    slug: slugSchema,
    name: localizedTextSchema(120),
    description: optionalLocalizedTextSchema(1000).default({}),
    categoryId: idSchema,
    basePrice: moneySchema,
    isConfigurable: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    tags: z.array(z.enum(PRODUCT_TAGS)).max(PRODUCT_TAGS.length).default([]),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    imageKey: z.string().max(300).nullable().optional(),
    sizes: z.array(productSizeInputSchema).max(6).default([]),
    ingredients: z.array(productIngredientInputSchema).max(40).default([]),
    crustIds: z.array(idSchema).max(10).default([]),
  })
  .refine((p) => !p.isConfigurable || p.sizes.length > 0, {
    error: V.required,
    path: ['sizes'],
  })
  .refine((p) => p.sizes.filter((s) => s.isDefault).length <= 1, {
    error: V.invalid,
    path: ['sizes'],
  })
  .refine((p) => new Set(p.ingredients.map((i) => i.ingredientId)).size === p.ingredients.length, {
    error: V.invalid,
    path: ['ingredients'],
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;

export const categoryInputSchema = z.strictObject({
  slug: slugSchema,
  name: localizedTextSchema(80),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const ingredientInputSchema = z.strictObject({
  name: localizedTextSchema(80),
  extraPrice: moneySchema,
  imageKey: z.string().max(300).nullable().optional(),
  isAvailable: z.boolean().default(true),
});
export type IngredientInput = z.input<typeof ingredientInputSchema>;

export const crustInputSchema = z.strictObject({
  name: localizedTextSchema(80),
  priceModifier: moneySchema,
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type CrustInput = z.input<typeof crustInputSchema>;

export const adminProductListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  categoryId: idSchema.optional(),
  status: z.enum(['active', 'unavailable', 'archived']).optional(),
});
export type AdminProductListQuery = z.input<typeof adminProductListQuerySchema>;
