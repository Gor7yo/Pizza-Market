import { Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  adminReviewListQuerySchema,
  createReviewSchema,
  moderateReviewSchema,
  paginationQuerySchema,
} from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import {
  AdminOnly,
  Authenticated,
  Client,
  type ClientInfo,
  CurrentUser,
  Public,
} from '../../common/auth/decorators';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:id/reviews')
  list(
    @UuidParam() productId: string,
    @ZodQuery(paginationQuerySchema) query: z.output<typeof paginationQuerySchema>,
  ) {
    return this.reviews.listApproved(productId, query.page, query.pageSize);
  }

  @Authenticated()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reviews')
  create(
    @CurrentUser() user: AuthUser,
    @ZodBody(createReviewSchema) body: z.output<typeof createReviewSchema>,
  ) {
    return this.reviews.create(user.id, body);
  }

  @AdminOnly()
  @Get('admin/reviews')
  adminList(
    @ZodQuery(adminReviewListQuerySchema) query: z.output<typeof adminReviewListQuerySchema>,
  ) {
    return this.reviews.adminList(query);
  }

  @AdminOnly()
  @Patch('admin/reviews/:id')
  async moderate(
    @UuidParam() id: string,
    @ZodBody(moderateReviewSchema) body: z.output<typeof moderateReviewSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ): Promise<{ ok: true }> {
    await this.reviews.moderate(id, body.status, user.id, client);
    return { ok: true };
  }
}
