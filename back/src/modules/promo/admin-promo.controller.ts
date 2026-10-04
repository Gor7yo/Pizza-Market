import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminPromoListQuerySchema,
  type PromoCodeData,
  promoCodeInputSchema,
} from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { AdminPromoService } from './admin-promo.service';

@ApiTags('admin')
@AdminOnly()
@Controller('admin/promo-codes')
export class AdminPromoController {
  constructor(private readonly promos: AdminPromoService) {}

  @Get()
  list(@ZodQuery(adminPromoListQuerySchema) query: z.output<typeof adminPromoListQuerySchema>) {
    return this.promos.list(query);
  }

  @Post()
  create(
    @ZodBody(promoCodeInputSchema) body: PromoCodeData,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.promos.create(body, user.id, client);
  }

  @Put(':id')
  update(
    @UuidParam() id: string,
    @ZodBody(promoCodeInputSchema) body: PromoCodeData,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.promos.update(id, body, user.id, client);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@UuidParam() id: string, @CurrentUser() user: AuthUser, @Client() client: ClientInfo) {
    return this.promos.remove(id, user.id, client);
  }
}
