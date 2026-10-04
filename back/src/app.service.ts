import { Injectable } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { RedisService } from './infrastructure/redis/redis.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: { database: boolean; redis: boolean };
  uptimeSeconds: number;
}

/** Liveness/readiness probe used by Docker and load balancers. */
@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async health(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      ),
      this.redis.client.ping().then(
        (r) => r === 'PONG',
        () => false,
      ),
    ]);
    return {
      status: database && redis ? 'ok' : 'degraded',
      checks: { database, redis },
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
