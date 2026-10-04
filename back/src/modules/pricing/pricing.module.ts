import { Global, Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PromoService } from './promo.service';
import { QuoteService } from './quote.service';

@Global()
@Module({
  providers: [PricingService, PromoService, QuoteService],
  exports: [PricingService, PromoService, QuoteService],
})
export class PricingModule {}
