import { Injectable } from '@nestjs/common';
import {
  calculateLineTotal,
  calculateUnitPrice,
  type CartItemInput,
  cartItemKey,
  type ErrorCode,
  type LocalizedText,
  mergeCartItems,
} from '@market/shared';
import { asLocalized } from '../../common/utils/json';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface ResolvedLine {
  key: string;
  input: CartItemInput;
  available: boolean;
  reason: ErrorCode | null;
  product: {
    id: string;
    slug: string;
    name: LocalizedText;
    imageKey: string | null;
    categoryId: string;
    basePrice: number;
  } | null;
  size: { id: string; sizeCm: number; priceModifier: number } | null;
  crust: { id: string; name: LocalizedText; priceModifier: number } | null;
  removed: { id: string; name: LocalizedText }[];
  extras: { id: string; name: LocalizedText; price: number }[];
  unitPrice: number;
  lineTotal: number;
}

const productInclude = {
  category: { select: { isActive: true, isArchived: true } },
  sizes: true,
  crusts: { include: { crust: true } },
  ingredients: { include: { ingredient: true } },
} satisfies Prisma.ProductInclude;

/**
 * The single authority for item prices. Takes only identifiers + quantities
 * (never prices) and validates every option against the current catalog.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    items: readonly CartItemInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<ResolvedLine[]> {
    const db = tx ?? this.prisma;
    const normalized = mergeCartItems([], items);
    const productIds = [...new Set(normalized.map((i) => i.productId))];
    const products = productIds.length
      ? await db.product.findMany({ where: { id: { in: productIds } }, include: productInclude })
      : [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return normalized.map((item) => this.resolveLine(item, byId.get(item.productId)));
  }

  private resolveLine(
    input: CartItemInput,
    product: Prisma.ProductGetPayload<{ include: typeof productInclude }> | undefined,
  ): ResolvedLine {
    const key = cartItemKey(input);
    const unavailable = (reason: ErrorCode, withProduct = true): ResolvedLine => ({
      key,
      input,
      available: false,
      reason,
      product:
        product && withProduct
          ? {
              id: product.id,
              slug: product.slug,
              name: asLocalized(product.name),
              imageKey: product.imageKey,
              categoryId: product.categoryId,
              basePrice: product.basePrice,
            }
          : null,
      size: null,
      crust: null,
      removed: [],
      extras: [],
      unitPrice: 0,
      lineTotal: 0,
    });

    if (!product) return unavailable('PRODUCT_UNAVAILABLE', false);
    if (
      product.isArchived ||
      !product.isAvailable ||
      product.category.isArchived ||
      !product.category.isActive
    ) {
      return unavailable('PRODUCT_UNAVAILABLE');
    }

    // size
    let size: ResolvedLine['size'] = null;
    if (product.isConfigurable) {
      const found = product.sizes.find((s) => s.id === input.sizeId);
      if (!found) return unavailable('INVALID_CONFIGURATION');
      size = { id: found.id, sizeCm: found.sizeCm, priceModifier: found.priceModifier };
    } else if (input.sizeId !== null) {
      return unavailable('INVALID_CONFIGURATION');
    }

    // crust: required when the product offers crusts, forbidden otherwise
    let crust: ResolvedLine['crust'] = null;
    const allowedCrusts = product.crusts.map((pc) => pc.crust).filter((c) => !c.isArchived);
    if (allowedCrusts.length > 0) {
      const found = allowedCrusts.find((c) => c.id === input.crustId);
      if (!found) return unavailable('INVALID_CONFIGURATION');
      if (!found.isAvailable) return unavailable('PRODUCT_UNAVAILABLE');
      crust = { id: found.id, name: asLocalized(found.name), priceModifier: found.priceModifier };
    } else if (input.crustId !== null) {
      return unavailable('INVALID_CONFIGURATION');
    }

    // ingredients
    const productIngredients = new Map(product.ingredients.map((pi) => [pi.ingredientId, pi]));
    const removed: ResolvedLine['removed'] = [];
    for (const id of input.removedIngredientIds) {
      const pi = productIngredients.get(id);
      if (!pi || pi.role !== 'DEFAULT' || !pi.isRemovable)
        return unavailable('INVALID_CONFIGURATION');
      removed.push({ id, name: asLocalized(pi.ingredient.name) });
    }
    const extras: ResolvedLine['extras'] = [];
    for (const id of input.extraIngredientIds) {
      const pi = productIngredients.get(id);
      if (!pi || pi.role !== 'EXTRA' || pi.ingredient.isArchived)
        return unavailable('INVALID_CONFIGURATION');
      if (!pi.ingredient.isAvailable) return unavailable('PRODUCT_UNAVAILABLE');
      extras.push({ id, name: asLocalized(pi.ingredient.name), price: pi.ingredient.extraPrice });
    }

    const unitPrice = calculateUnitPrice({
      basePrice: product.basePrice,
      sizeModifier: size?.priceModifier ?? 0,
      crustModifier: crust?.priceModifier ?? 0,
      extraPrices: extras.map((e) => e.price),
    });

    return {
      key,
      input,
      available: true,
      reason: null,
      product: {
        id: product.id,
        slug: product.slug,
        name: asLocalized(product.name),
        imageKey: product.imageKey,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
      },
      size,
      crust,
      removed,
      extras,
      unitPrice,
      lineTotal: calculateLineTotal(unitPrice, input.quantity),
    };
  }
}
