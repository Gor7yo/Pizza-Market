import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { UsersModule } from '../users/users.module';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, UsersModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderStatusService, AdminOrdersService],
  exports: [AdminOrdersService],
})
export class OrdersModule {}
