import { Injectable } from '@nestjs/common';
import {
  type Currency,
  CURRENCIES,
  type ExchangeRates,
  type StoreSettingsData,
  type StoreSettingsDto,
  storeSettingsSchema,
} from '@market/shared';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppConfig } from '../../config/app-config.service';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditService, diffChanges } from '../audit/audit.service';

const STORE_KEY = 'store';
const CACHE_KEY = 'cache:settings:store';
const CACHE_TTL_SECONDS = 60;

export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  isAcceptingOrders: true,
  deliveryFee: 800,
  freeDeliveryThreshold: 10_000,
  minOrderAmount: 3_000,
  pickupAddress: 'Yerevan, Abovyan St. 10',
  supportPhone: '+374 10 000000',
  exchangeRates: { USD: null, RUB: null },
};

interface StoredSettings {
  data: StoreSettingsData;
  ratesUpdatedAt: string | null;
}

/**
 * Store-wide settings. Read on every cart quote, so they are cached in Redis
 * (invalidated on update). The store currency itself comes from env: changing it
 * on a live database would silently re-interpret every stored price.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  get currency(): Currency {
    return this.config.get('STORE_CURRENCY');
  }

  async get(): Promise<StoreSettingsDto> {
    const stored = await this.load();
    return this.toDto(stored);
  }

  async update(
    input: StoreSettingsData,
    actorId: string,
    client: ClientInfo,
  ): Promise<StoreSettingsDto> {
    const before = await this.load();
    const ratesChanged =
      JSON.stringify(before.data.exchangeRates) !== JSON.stringify(input.exchangeRates);
    const next: StoredSettings = {
      data: input,
      ratesUpdatedAt: ratesChanged ? new Date().toISOString() : before.ratesUpdatedAt,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: STORE_KEY },
        create: { key: STORE_KEY, value: next as unknown as Prisma.InputJsonValue },
        update: { value: next as unknown as Prisma.InputJsonValue },
      });
      await this.audit.log(
        {
          actorId,
          action: 'settings.update',
          entityType: 'Setting',
          entityId: STORE_KEY,
          metadata: { changes: diffChanges(before.data, input) },
          client,
        },
        tx,
      );
    });
    await this.redis.client.del(CACHE_KEY);
    return this.toDto(next);
  }

  private async load(): Promise<StoredSettings> {
    const cached = await this.redis.getJson<StoredSettings>(CACHE_KEY);
    if (cached) return cached;

    const row = await this.prisma.setting.findUnique({ where: { key: STORE_KEY } });
    const raw = (row?.value ?? null) as { data?: unknown; ratesUpdatedAt?: unknown } | null;
    const parsed = storeSettingsSchema.safeParse(raw?.data);
    const stored: StoredSettings = {
      data: parsed.success ? parsed.data : DEFAULT_STORE_SETTINGS,
      ratesUpdatedAt: typeof raw?.ratesUpdatedAt === 'string' ? raw.ratesUpdatedAt : null,
    };
    await this.redis.setJson(CACHE_KEY, stored, CACHE_TTL_SECONDS);
    return stored;
  }

  private toDto(stored: StoredSettings): StoreSettingsDto {
    const { exchangeRates, ...rest } = stored.data;
    return {
      ...rest,
      currency: this.currency,
      exchangeRates: this.rates(exchangeRates, stored.ratesUpdatedAt),
    };
  }

  private rates(raw: StoreSettingsData['exchangeRates'], updatedAt: string | null): ExchangeRates {
    const rates: ExchangeRates['rates'] = {};
    for (const c of CURRENCIES) {
      const value = raw[c];
      if (c !== this.currency && value) rates[c] = value;
    }
    return { base: this.currency, rates, updatedAt };
  }
}
