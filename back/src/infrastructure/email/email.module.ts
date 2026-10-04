import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { QUEUES } from '../queue/queues';
import { ConsoleEmailProvider, EmailProvider, ResendEmailProvider } from './email.provider';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.email })],
  providers: [
    {
      provide: EmailProvider,
      inject: [AppConfig, RedisService],
      useFactory: (config: AppConfig, redis: RedisService): EmailProvider =>
        config.get('EMAIL_PROVIDER') === 'resend'
          ? new ResendEmailProvider(config)
          : new ConsoleEmailProvider(config, redis),
    },
    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService],
})
export class EmailModule {}
