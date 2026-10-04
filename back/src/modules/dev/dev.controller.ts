import { Controller, Get, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { DEV_MAILBOX_KEY } from '../../infrastructure/email/email.provider';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * Development/E2E helpers. The module is registered only when
 * DEV_ENDPOINTS_ENABLED=true, which env validation forbids in production.
 */
@ApiExcludeController()
@Public()
@Controller('dev')
export class DevController {
  constructor(private readonly redis: RedisService) {}

  /** Last e-mails captured by the console provider (newest first). */
  @Get('emails')
  async emails(@Query('to') to?: string): Promise<unknown[]> {
    const raw = await this.redis.client.lrange(DEV_MAILBOX_KEY, 0, 49);
    const items = raw.map((r) => JSON.parse(r) as { to: string });
    return to ? items.filter((m) => m.to.toLowerCase() === to.toLowerCase()) : items;
  }
}
