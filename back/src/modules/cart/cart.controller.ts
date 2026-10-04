import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CartQuoteDto,
  quoteCartSchema,
  replaceCartSchema,
  type ServerCartDto,
} from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { Authenticated, CurrentUser, OptionalUser, Public } from '../../common/auth/decorators';
import { ZodBody } from '../../common/validation/zod.decorators';
import { QuoteService } from '../pricing/quote.service';
import { CartService } from './cart.service';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly quotes: QuoteService,
  ) {}

  /** Prices any cart (anonymous or not). The only source of prices shown in the cart UI. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('quote')
  async quote(
    @ZodBody(quoteCartSchema) body: z.output<typeof quoteCartSchema>,
    @OptionalUser() user: AuthUser | null,
  ): Promise<CartQuoteDto> {
    const result = await this.quotes.quote({ ...body, userId: user?.id ?? null });
    return result.dto;
  }

  @Authenticated()
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<ServerCartDto> {
    return this.cart.get(user.id);
  }

  @Authenticated()
  @Put()
  replace(
    @CurrentUser() user: AuthUser,
    @ZodBody(replaceCartSchema) body: z.output<typeof replaceCartSchema>,
  ): Promise<ServerCartDto> {
    return this.cart.replace(user.id, body.items);
  }

  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @Post('merge')
  merge(
    @CurrentUser() user: AuthUser,
    @ZodBody(replaceCartSchema) body: z.output<typeof replaceCartSchema>,
  ): Promise<ServerCartDto> {
    return this.cart.merge(user.id, body.items);
  }

  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  clear(@CurrentUser() user: AuthUser): Promise<void> {
    return this.cart.clear(user.id);
  }
}
