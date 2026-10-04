import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { AppConfig } from '../../config/app-config.service';

/** Parses redis[s]://user:pass@host:port/db into ioredis options (also used by BullMQ). */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    // ?family=0 enables IPv6 lookups (required on IPv6-only private networks, e.g. Railway)
    family: Number(parsed.searchParams.get('family') ?? 4),
  };
}

/**
 * Shared Redis connection for rate limiting, short-lived security state
 * (login lockouts, revoked sessions, cooldowns) and small caches.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: AppConfig) {
    this.client = new Redis({
      ...redisOptionsFromUrl(config.get('REDIS_URL')),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });
    this.client.on('error', (err) => this.logger.error({ err }, 'Redis error'));
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
