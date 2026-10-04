import { Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { adminOrderListQuerySchema, updateOrderStatusSchema } from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { AdminOrdersService } from './admin-orders.service';
import { OrderStatusService } from './order-status.service';

@ApiTags('admin')
@AdminOnly()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly status: OrderStatusService,
  ) {}

  @Get()
  list(@ZodQuery(adminOrderListQuerySchema) query: z.output<typeof adminOrderListQuerySchema>) {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@UuidParam() id: string) {
    return this.orders.get(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @UuidParam() id: string,
    @ZodBody(updateOrderStatusSchema) body: z.output<typeof updateOrderStatusSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    await this.status.transition(
      id,
      body.status,
      { userId: user.id, kind: 'admin', client },
      body.note,
    );
    return this.orders.get(id);
  }
}
