import { Module } from '@nestjs/common';
import { AdminPromoController } from './admin-promo.controller';
import { AdminPromoService } from './admin-promo.service';

@Module({
  controllers: [AdminPromoController],
  providers: [AdminPromoService],
})
export class PromoModule {}
