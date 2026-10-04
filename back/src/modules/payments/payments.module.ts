import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider';
import { PaymentsService } from './payments.service';

@Global()
@Module({
  providers: [
    {
      provide: PaymentProvider,
      inject: [AppConfig],
      // Add real providers here and select them with PAYMENT_PROVIDER.
      useFactory: (config: AppConfig): PaymentProvider => {
        switch (config.get('PAYMENT_PROVIDER')) {
          case 'mock':
            return new MockPaymentProvider(config);
        }
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
