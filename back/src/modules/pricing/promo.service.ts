import { Injectable } from '@nestjs/common';
import { calculateDiscount, type ErrorCode } from '@market/shared';
import type { Prisma, PromoCode } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ResolvedLine } from './pricing.service';

export type PromoWithScope = PromoCode & {
  products: { id: string }[];
  categories: { id: string }[];
};

export type PromoEvaluation =
  | { ok: true; promo: PromoWithScope; discount: number }
  | { ok: false; errorCode: ErrorCode; promo: PromoWithScope | null };

/**
 * Pure promo rules (exported for unit tests). The caller supplies the user's
 * previous usage count; null = anonymous quote (per-user limit is re-checked at checkout).
 */
export function evaluatePromo(
  promo: PromoWithScope | null,
  lines: readonly ResolvedLine[],
  now: Date,
  userUsageCount: number | null,
): PromoEvaluation {
  if (!promo) return { ok: false, errorCode: 'PROMO_NOT_FOUND', promo: null };
  if (!promo.isActive) return { ok: false, errorCode: 'PROMO_INACTIVE', promo };
  if (promo.startsAt && promo.startsAt > now)
    return { ok: false, errorCode: 'PROMO_NOT_STARTED', promo };
  if (promo.expiresAt && promo.expiresAt <= now)
    return { ok: false, errorCode: 'PROMO_EXPIRED', promo };
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, errorCode: 'PROMO_USAGE_LIMIT', promo };
  }
  if (
    promo.perUserLimit !== null &&
    userUsageCount !== null &&
    userUsageCount >= promo.perUserLimit
  ) {
    return { ok: false, errorCode: 'PROMO_USAGE_LIMIT', promo };
  }

  const available = lines.filter((l) => l.available);
  const subtotal = available.reduce((sum, l) => sum + l.lineTotal, 0);
  if (subtotal < promo.minOrderAmount) return { ok: false, errorCode: 'PROMO_MIN_ORDER', promo };

  const productIds = new Set(promo.products.map((p) => p.id));
  const categoryIds = new Set(promo.categories.map((c) => c.id));
  const scoped = productIds.size > 0 || categoryIds.size > 0;
  const eligible = scoped
    ? available
        .filter(
          (l) =>
            l.product && (productIds.has(l.product.id) || categoryIds.has(l.product.categoryId)),
        )
        .reduce((sum, l) => sum + l.lineTotal, 0)
    : subtotal;
  if (eligible === 0) return { ok: false, errorCode: 'PROMO_NOT_APPLICABLE', promo };

  const discount = calculateDiscount(
    { type: promo.type, value: promo.value, maxDiscount: promo.maxDiscount },
    eligible,
  );
  return { ok: true, promo, discount };
}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    code: string,
    lines: readonly ResolvedLine[],
    userId: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<PromoEvaluation> {
    const db = tx ?? this.prisma;
    const promo = await db.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { products: { select: { id: true } }, categories: { select: { id: true } } },
    });
    const usage =
      promo && userId && promo.perUserLimit !== null
        ? await db.promoCodeUsage.count({ where: { promoCodeId: promo.id, userId } })
        : null;
    return evaluatePromo(promo, lines, new Date(), usage);
  }

  /**
   * Atomically consumes one usage inside the order transaction.
   * Returns false if the global limit was reached concurrently.
   */
  async consume(
    promo: PromoCode,
    userId: string,
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const { count } = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        isActive: true,
        ...(promo.usageLimit !== null ? { usedCount: { lt: promo.usageLimit } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (count !== 1) return false;
    await tx.promoCodeUsage.create({ data: { promoCodeId: promo.id, userId, orderId } });
    return true;
  }
}
