import { Injectable } from '@nestjs/common';
import type {
  adminPromoListQuerySchema,
  Paginated,
  PromoCodeData,
  PromoCodeDto,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { pageArgs, paginated } from '../../common/utils/pagination';
import type { Prisma, PromoCode } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService, diffChanges } from '../audit/audit.service';

type PromoWithScope = PromoCode & { products: { id: string }[]; categories: { id: string }[] };

const scopeInclude = {
  products: { select: { id: true } },
  categories: { select: { id: true } },
} satisfies Prisma.PromoCodeInclude;

function toDto(p: PromoWithScope): PromoCodeDto {
  return {
    id: p.id,
    code: p.code,
    description: p.description,
    type: p.type,
    value: p.value,
    maxDiscount: p.maxDiscount,
    minOrderAmount: p.minOrderAmount,
    startsAt: p.startsAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    usageLimit: p.usageLimit,
    perUserLimit: p.perUserLimit,
    usedCount: p.usedCount,
    isActive: p.isActive,
    productIds: p.products.map((x) => x.id),
    categoryIds: p.categories.map((x) => x.id),
    createdAt: p.createdAt.toISOString(),
  };
}

function scalar(input: PromoCodeData) {
  return {
    code: input.code,
    description: input.description || null,
    type: input.type,
    value: input.value,
    maxDiscount: input.type === 'PERCENT' ? input.maxDiscount : null,
    minOrderAmount: input.minOrderAmount,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    usageLimit: input.usageLimit,
    perUserLimit: input.perUserLimit,
    isActive: input.isActive,
  };
}

@Injectable()
export class AdminPromoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: z.output<typeof adminPromoListQuerySchema>): Promise<Paginated<PromoCodeDto>> {
    const where: Prisma.PromoCodeWhereInput = query.q
      ? { code: { contains: query.q.toUpperCase() } }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.promoCode.findMany({
        where,
        include: scopeInclude,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.promoCode.count({ where }),
    ]);
    return paginated(rows.map(toDto), total, query.page, query.pageSize);
  }

  async create(input: PromoCodeData, actorId: string, client: ClientInfo): Promise<PromoCodeDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.create({
        data: {
          ...scalar(input),
          products: { connect: input.productIds.map((id) => ({ id })) },
          categories: { connect: input.categoryIds.map((id) => ({ id })) },
        },
        include: scopeInclude,
      });
      await this.audit.log(
        {
          actorId,
          action: 'promo.create',
          entityType: 'PromoCode',
          entityId: promo.id,
          metadata: scalar(input),
          client,
        },
        tx,
      );
      return promo;
    });
    return toDto(created);
  }

  async update(
    id: string,
    input: PromoCodeData,
    actorId: string,
    client: ClientInfo,
  ): Promise<PromoCodeDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.promoCode.findUnique({ where: { id } });
      if (!before) throw AppException.notFound('Promo code');
      const promo = await tx.promoCode.update({
        where: { id },
        data: {
          ...scalar(input),
          products: { set: input.productIds.map((pid) => ({ id: pid })) },
          categories: { set: input.categoryIds.map((cid) => ({ id: cid })) },
        },
        include: scopeInclude,
      });
      const {
        code,
        description,
        type,
        value,
        maxDiscount,
        minOrderAmount,
        startsAt,
        expiresAt,
        usageLimit,
        perUserLimit,
        isActive,
      } = before;
      await this.audit.log(
        {
          actorId,
          action: 'promo.update',
          entityType: 'PromoCode',
          entityId: id,
          metadata: {
            changes: diffChanges(
              {
                code,
                description,
                type,
                value,
                maxDiscount,
                minOrderAmount,
                startsAt,
                expiresAt,
                usageLimit,
                perUserLimit,
                isActive,
              },
              scalar(input),
            ),
          },
          client,
        },
        tx,
      );
      return promo;
    });
    return toDto(updated);
  }

  /** Used codes cannot be deleted (orders reference them) - deactivate them instead. */
  async remove(id: string, actorId: string, client: ClientInfo): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const promo = await tx.promoCode.findUnique({ where: { id } });
      if (!promo) throw AppException.notFound('Promo code');
      if (promo.usedCount > 0) {
        throw AppException.conflict(
          'CONFLICT',
          'Promo code was already used; deactivate it instead',
        );
      }
      await tx.promoCode.delete({ where: { id } });
      await this.audit.log(
        {
          actorId,
          action: 'promo.delete',
          entityType: 'PromoCode',
          entityId: id,
          metadata: { code: promo.code },
          client,
        },
        tx,
      );
    });
  }
}
