import { Injectable } from '@nestjs/common';
import type {
  AdminCategoryDto,
  AdminCrustDto,
  AdminIngredientDto,
  categoryInputSchema,
  crustInputSchema,
  ingredientInputSchema,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { asLocalized, cleanLocalized } from '../../common/utils/json';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { ImageService } from '../../infrastructure/storage/image.service';
import { AuditService, diffChanges } from '../audit/audit.service';
import { toCrustDto, toIngredientDto } from './catalog.mapper';

type CategoryInput = z.output<typeof categoryInputSchema>;
type IngredientInput = z.output<typeof ingredientInputSchema>;
type CrustInput = z.output<typeof crustInputSchema>;

/** Admin CRUD for the small catalog dictionaries. Everything is archived, never hard-deleted. */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly images: ImageService,
    private readonly audit: AuditService,
  ) {}

  /* ---------- categories ---------- */

  async listCategories(): Promise<AdminCategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { products: { where: { isArchived: false } } } } },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: asLocalized(c.name),
      sortOrder: c.sortOrder,
      productCount: c._count.products,
      isActive: c.isActive,
      isArchived: c.isArchived,
    }));
  }

  async saveCategory(id: string | null, input: CategoryInput, actorId: string, client: ClientInfo) {
    const data = {
      slug: input.slug,
      name: cleanLocalized(input.name),
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    await this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.category.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Category');
      const saved = id
        ? await tx.category.update({ where: { id }, data })
        : await tx.category.create({ data });
      await this.audit.log(
        {
          actorId,
          action: id ? 'category.update' : 'category.create',
          entityType: 'Category',
          entityId: saved.id,
          metadata: before
            ? {
                changes: diffChanges(
                  {
                    slug: before.slug,
                    name: before.name,
                    sortOrder: before.sortOrder,
                    isActive: before.isActive,
                  },
                  data,
                ),
              }
            : data,
          client,
        },
        tx,
      );
    });
    return this.listCategories();
  }

  async archiveCategory(id: string, isArchived: boolean, actorId: string, client: ClientInfo) {
    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { isArchived } });
      await this.audit.log(
        {
          actorId,
          action: isArchived ? 'category.archive' : 'category.restore',
          entityType: 'Category',
          entityId: id,
          client,
        },
        tx,
      );
    });
    return this.listCategories();
  }

  /* ---------- ingredients ---------- */

  async listIngredients(): Promise<AdminIngredientDto[]> {
    const rows = await this.prisma.ingredient.findMany({
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((i) => ({
      ...toIngredientDto(i, this.storage),
      imageKey: i.imageKey,
      isArchived: i.isArchived,
    }));
  }

  async saveIngredient(
    id: string | null,
    input: IngredientInput,
    actorId: string,
    client: ClientInfo,
  ) {
    const data = {
      name: cleanLocalized(input.name),
      extraPrice: input.extraPrice,
      imageKey: input.imageKey ?? null,
      isAvailable: input.isAvailable,
    };
    const previousImage = await this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.ingredient.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Ingredient');
      const saved = id
        ? await tx.ingredient.update({ where: { id }, data })
        : await tx.ingredient.create({ data });
      await this.audit.log(
        {
          actorId,
          action: id ? 'ingredient.update' : 'ingredient.create',
          entityType: 'Ingredient',
          entityId: saved.id,
          metadata: before
            ? {
                changes: diffChanges(
                  {
                    name: before.name,
                    extraPrice: before.extraPrice,
                    imageKey: before.imageKey,
                    isAvailable: before.isAvailable,
                  },
                  data,
                ),
              }
            : data,
          client,
        },
        tx,
      );
      return before?.imageKey ?? null;
    });
    if (previousImage && previousImage !== data.imageKey) await this.images.remove(previousImage);
    return this.listIngredients();
  }

  async archiveIngredient(id: string, isArchived: boolean, actorId: string, client: ClientInfo) {
    await this.prisma.$transaction(async (tx) => {
      await tx.ingredient.update({ where: { id }, data: { isArchived } });
      await this.audit.log(
        {
          actorId,
          action: isArchived ? 'ingredient.archive' : 'ingredient.restore',
          entityType: 'Ingredient',
          entityId: id,
          client,
        },
        tx,
      );
    });
    return this.listIngredients();
  }

  /* ---------- crusts ---------- */

  async listCrusts(): Promise<AdminCrustDto[]> {
    const rows = await this.prisma.crust.findMany({
      orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map((c) => ({ ...toCrustDto(c), isArchived: c.isArchived }));
  }

  async saveCrust(id: string | null, input: CrustInput, actorId: string, client: ClientInfo) {
    const data = {
      name: cleanLocalized(input.name),
      priceModifier: input.priceModifier,
      isAvailable: input.isAvailable,
      sortOrder: input.sortOrder,
    };
    await this.prisma.$transaction(async (tx) => {
      const before = id ? await tx.crust.findUnique({ where: { id } }) : null;
      if (id && !before) throw AppException.notFound('Crust');
      const saved = id
        ? await tx.crust.update({ where: { id }, data })
        : await tx.crust.create({ data });
      await this.audit.log(
        {
          actorId,
          action: id ? 'crust.update' : 'crust.create',
          entityType: 'Crust',
          entityId: saved.id,
          metadata: before
            ? {
                changes: diffChanges(
                  {
                    name: before.name,
                    priceModifier: before.priceModifier,
                    isAvailable: before.isAvailable,
                    sortOrder: before.sortOrder,
                  },
                  data,
                ),
              }
            : data,
          client,
        },
        tx,
      );
    });
    return this.listCrusts();
  }

  async archiveCrust(id: string, isArchived: boolean, actorId: string, client: ClientInfo) {
    await this.prisma.$transaction(async (tx) => {
      await tx.crust.update({ where: { id }, data: { isArchived } });
      await this.audit.log(
        {
          actorId,
          action: isArchived ? 'crust.archive' : 'crust.restore',
          entityType: 'Crust',
          entityId: id,
          client,
        },
        tx,
      );
    });
    return this.listCrusts();
  }
}
