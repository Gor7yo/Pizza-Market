import { Injectable } from '@nestjs/common';
import {
  type AdminProductDto,
  type adminProductListQuerySchema,
  buildSearchText,
  type Paginated,
  type ProductData,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { cleanLocalized } from '../../common/utils/json';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { ImageService } from '../../infrastructure/storage/image.service';
import { AuditService, diffChanges } from '../audit/audit.service';
import { productDetailInclude, toAdminProduct } from './catalog.mapper';

/** Fields recorded in the audit log diff (prices included, e.g. "basePrice: 4500 -> 5000"). */
function auditSnapshot(p: {
  slug: string;
  name: unknown;
  basePrice: number;
  categoryId: string;
  isAvailable: boolean;
  isConfigurable: boolean;
  tags: string[];
  sizes: { sizeCm: number; priceModifier: number }[];
  imageKey: string | null;
}) {
  return {
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    categoryId: p.categoryId,
    isAvailable: p.isAvailable,
    isConfigurable: p.isConfigurable,
    tags: [...p.tags].sort(),
    sizes: [...p.sizes]
      .sort((a, b) => a.sizeCm - b.sizeCm)
      .map((s) => `${s.sizeCm}cm:+${s.priceModifier}`),
    imageKey: p.imageKey,
  };
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly images: ImageService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: z.output<typeof adminProductListQuerySchema>,
  ): Promise<Paginated<AdminProductDto>> {
    const where: Prisma.ProductWhereInput = {
      categoryId: query.categoryId,
      searchText: query.q ? { contains: query.q.toLowerCase() } : undefined,
      ...(query.status === 'archived'
        ? { isArchived: true }
        : query.status === 'unavailable'
          ? { isArchived: false, isAvailable: false }
          : query.status === 'active'
            ? { isArchived: false, isAvailable: true }
            : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productDetailInclude,
        orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(
      rows.map((p) => toAdminProduct(p, this.storage)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async get(id: string): Promise<AdminProductDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
    if (!product) throw AppException.notFound('Product');
    return toAdminProduct(product, this.storage);
  }

  private async assertReferences(input: ProductData, tx: Prisma.TransactionClient): Promise<void> {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, isArchived: false },
    });
    if (!category)
      throw AppException.badRequest('VALIDATION_ERROR', 'Unknown category', {
        categoryId: 'invalid',
      });

    const ingredientIds = input.ingredients.map((i) => i.ingredientId);
    if (ingredientIds.length) {
      const found = await tx.ingredient.count({
        where: { id: { in: ingredientIds }, isArchived: false },
      });
      if (found !== ingredientIds.length) {
        throw AppException.badRequest('VALIDATION_ERROR', 'Unknown ingredient', {
          ingredients: 'invalid',
        });
      }
    }
    if (input.crustIds.length) {
      const found = await tx.crust.count({
        where: { id: { in: input.crustIds }, isArchived: false },
      });
      if (found !== new Set(input.crustIds).size) {
        throw AppException.badRequest('VALIDATION_ERROR', 'Unknown crust', { crustIds: 'invalid' });
      }
    }
  }

  private scalarData(input: ProductData) {
    const name = cleanLocalized(input.name);
    const description = cleanLocalized(input.description);
    return {
      slug: input.slug,
      name,
      description,
      searchText: buildSearchText(
        name as Record<string, string>,
        description as Record<string, string>,
      ),
      basePrice: input.basePrice,
      isConfigurable: input.isConfigurable,
      isAvailable: input.isAvailable,
      tags: input.tags,
      sortOrder: input.sortOrder,
      imageKey: input.imageKey ?? null,
    };
  }

  private relationRows(input: ProductData) {
    return {
      ingredients: input.ingredients.map((i, index) => ({
        ingredientId: i.ingredientId,
        role: i.role,
        isRemovable: i.isRemovable,
        sortOrder: index,
      })),
      crusts: [...new Set(input.crustIds)].map((crustId) => ({ crustId })),
    };
  }

  async create(input: ProductData, actorId: string, client: ClientInfo): Promise<AdminProductDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertReferences(input, tx);
      const rel = this.relationRows(input);
      const product = await tx.product.create({
        data: {
          ...this.scalarData(input),
          category: { connect: { id: input.categoryId } },
          sizes: {
            create: input.sizes.map((s) => ({
              sizeCm: s.sizeCm,
              weightGrams: s.weightGrams ?? null,
              priceModifier: s.priceModifier,
              isDefault: s.isDefault,
            })),
          },
          ingredients: { create: rel.ingredients },
          crusts: { create: rel.crusts },
        },
        include: productDetailInclude,
      });
      await this.audit.log(
        {
          actorId,
          action: 'product.create',
          entityType: 'Product',
          entityId: product.id,
          metadata: auditSnapshot(product),
          client,
        },
        tx,
      );
      return product;
    });
    return toAdminProduct(created, this.storage);
  }

  async update(
    id: string,
    input: ProductData,
    actorId: string,
    client: ClientInfo,
  ): Promise<AdminProductDto> {
    const before = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
    if (!before) throw AppException.notFound('Product');

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.assertReferences(input, tx);
      const rel = this.relationRows(input);

      // sizes: delete removed, update kept, create new (order items keep their own snapshot)
      const keepIds = input.sizes.flatMap((s) => (s.id ? [s.id] : []));
      await tx.productSize.deleteMany({ where: { productId: id, id: { notIn: keepIds } } });
      for (const s of input.sizes) {
        const data = {
          sizeCm: s.sizeCm,
          weightGrams: s.weightGrams ?? null,
          priceModifier: s.priceModifier,
          isDefault: s.isDefault,
        };
        if (s.id) {
          const { count } = await tx.productSize.updateMany({
            where: { id: s.id, productId: id },
            data,
          });
          if (count !== 1)
            throw AppException.badRequest('VALIDATION_ERROR', 'Unknown size', { sizes: 'invalid' });
        } else {
          await tx.productSize.create({ data: { ...data, productId: id } });
        }
      }

      await tx.productIngredient.deleteMany({ where: { productId: id } });
      await tx.productCrust.deleteMany({ where: { productId: id } });

      const product = await tx.product.update({
        where: { id },
        data: {
          ...this.scalarData(input),
          category: { connect: { id: input.categoryId } },
          ingredients: { create: rel.ingredients },
          crusts: { create: rel.crusts },
        },
        include: productDetailInclude,
      });

      await this.audit.log(
        {
          actorId,
          action: 'product.update',
          entityType: 'Product',
          entityId: id,
          metadata: { changes: diffChanges(auditSnapshot(before), auditSnapshot(product)) },
          client,
        },
        tx,
      );
      return product;
    });

    if (before.imageKey && before.imageKey !== updated.imageKey)
      await this.images.remove(before.imageKey);
    return toAdminProduct(updated, this.storage);
  }

  /** Products are never hard-deleted: historical orders reference them. */
  async setArchived(
    id: string,
    isArchived: boolean,
    actorId: string,
    client: ClientInfo,
  ): Promise<AdminProductDto> {
    return this.patch(
      id,
      { isArchived },
      isArchived ? 'product.archive' : 'product.restore',
      actorId,
      client,
    );
  }

  async setAvailability(
    id: string,
    isAvailable: boolean,
    actorId: string,
    client: ClientInfo,
  ): Promise<AdminProductDto> {
    return this.patch(id, { isAvailable }, 'product.availability', actorId, client);
  }

  private async patch(
    id: string,
    data: { isArchived?: boolean; isAvailable?: boolean },
    action: string,
    actorId: string,
    client: ClientInfo,
  ): Promise<AdminProductDto> {
    const product = await this.prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({
        where: { id },
        select: { isArchived: true, isAvailable: true },
      });
      if (!exists) throw AppException.notFound('Product');
      const updated = await tx.product.update({
        where: { id },
        data,
        include: productDetailInclude,
      });
      await this.audit.log(
        {
          actorId,
          action,
          entityType: 'Product',
          entityId: id,
          metadata: { changes: diffChanges(exists, data) },
          client,
        },
        tx,
      );
      return updated;
    });
    return toAdminProduct(product, this.storage);
  }
}
