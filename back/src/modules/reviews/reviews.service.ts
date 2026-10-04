import { Injectable } from '@nestjs/common';
import type {
  AdminReviewDto,
  adminReviewListQuerySchema,
  createReviewSchema,
  Paginated,
  ReviewDto,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { asLocalized } from '../../common/utils/json';
import { pageArgs, paginated } from '../../common/utils/pagination';
import { Prisma, type Review, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function authorName(u: Pick<User, 'firstName' | 'lastName'>): string {
  return u.lastName ? `${u.firstName} ${u.lastName.charAt(0)}.` : u.firstName;
}

function toReviewDto(r: Review & { user: Pick<User, 'firstName' | 'lastName'> }): ReviewDto {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    authorName: authorName(r.user),
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listApproved(
    productId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ReviewDto>> {
    const where: Prisma.ReviewWhereInput = { productId, status: 'APPROVED' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
        ...pageArgs(page, pageSize),
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(rows.map(toReviewDto), total, page, pageSize);
  }

  /**
   * Only customers with a delivered order containing the product may review it,
   * once per product (unique constraint). Reviews start PENDING moderation.
   */
  async create(userId: string, input: z.output<typeof createReviewSchema>): Promise<ReviewDto> {
    const purchased = await this.prisma.orderItem.findFirst({
      where: { productId: input.productId, order: { userId, status: 'DELIVERED' } },
      select: { id: true },
    });
    if (!purchased)
      throw AppException.forbidden('REVIEW_NOT_ALLOWED', 'You can review only purchased products');

    try {
      const review = await this.prisma.review.create({
        data: {
          productId: input.productId,
          userId,
          rating: input.rating,
          comment: input.comment || null,
        },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      return toReviewDto(review);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict('REVIEW_EXISTS', 'You already reviewed this product');
      }
      throw err;
    }
  }

  async adminList(
    query: z.output<typeof adminReviewListQuerySchema>,
  ): Promise<Paginated<AdminReviewDto>> {
    const where: Prisma.ReviewWhereInput = { status: query.status };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          product: { select: { id: true, slug: true, name: true } },
        },
        ...pageArgs(query.page, query.pageSize),
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({
        ...toReviewDto(r),
        status: r.status,
        product: { id: r.product.id, slug: r.product.slug, name: asLocalized(r.product.name) },
        user: { id: r.user.id, email: r.user.email },
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Moderation also recomputes the product rating from approved reviews. */
  async moderate(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    actorId: string,
    client: ClientInfo,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id } });
      if (!review) throw AppException.notFound('Review');
      await tx.review.update({ where: { id }, data: { status } });

      const agg = await tx.review.aggregate({
        where: { productId: review.productId, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.product.update({
        where: { id: review.productId },
        data: {
          ratingAvg: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10,
          ratingCount: agg._count._all,
        },
      });
      await this.audit.log(
        {
          actorId,
          action: 'review.moderate',
          entityType: 'Review',
          entityId: id,
          metadata: { from: review.status, to: status, productId: review.productId },
          client,
        },
        tx,
      );
    });
  }
}
