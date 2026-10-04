import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  createOrderSchema,
  idSchema,
  mockPaymentConfirmSchema,
  type OrderDetailDto,
  orderListQuerySchema,
  type PaymentDto,
} from '@market/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { Authenticated, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { PaymentsService } from '../payments/payments.service';
import { toPaymentDto } from './orders.mapper';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Authenticated()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  /** 201 for a new order, 200 when the same Idempotency-Key is replayed. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID generated per checkout attempt',
  })
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @ZodBody(createOrderSchema) body: z.output<typeof createOrderSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Client() client: ClientInfo,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDetailDto> {
    const key = idSchema.safeParse(idempotencyKey);
    if (!key.success) {
      throw AppException.badRequest('VALIDATION_ERROR', 'Idempotency-Key header must be a UUID', {
        'idempotency-key': 'invalid',
      });
    }
    const { order, created } = await this.orders.create(user.id, body, key.data, client);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @ZodQuery(orderListQuerySchema) query: z.output<typeof orderListQuerySchema>,
  ) {
    return this.orders.listForUser(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<OrderDetailDto> {
    return this.orders.getForUser(user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<OrderDetailDto> {
    return this.orders.cancelByCustomer(user.id, id);
  }

  /** Mock provider only: simulates the provider's confirmation callback. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post(':id/payment/mock-confirm')
  async mockConfirm(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(mockPaymentConfirmSchema) body: z.output<typeof mockPaymentConfirmSchema>,
  ): Promise<PaymentDto> {
    return toPaymentDto(await this.payments.confirmMock(id, user.id, body.outcome));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post(':id/payment/retry')
  async retryPayment(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<PaymentDto> {
    return toPaymentDto(await this.payments.retry(id, user.id));
  }
}
