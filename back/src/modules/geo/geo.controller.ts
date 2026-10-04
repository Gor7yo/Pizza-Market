import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type GeocodeResultDto, LOCALES } from '@market/shared';
import { z } from 'zod';
import { Public } from '../../common/auth/decorators';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { GeocodingProvider } from './geocoding.provider';

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  locale: z.enum(LOCALES).default('ru'),
});
const searchSchema = z.object({
  q: z.string().trim().min(3).max(200),
  locale: z.enum(LOCALES).default('ru'),
});

const CACHE_TTL = 24 * 3600;

@ApiTags('geo')
@Public()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('geo')
export class GeoController {
  constructor(
    private readonly geocoder: GeocodingProvider,
    private readonly redis: RedisService,
  ) {}

  @Get('reverse')
  async reverse(
    @ZodQuery(reverseSchema) q: z.output<typeof reverseSchema>,
  ): Promise<GeocodeResultDto | null> {
    // ~11 m precision is plenty for an address and makes the cache effective
    const lat = Number(q.lat.toFixed(4));
    const lng = Number(q.lng.toFixed(4));
    const key = `cache:geo:rev:${q.locale}:${lat}:${lng}`;
    const cached = await this.redis.getJson<{ v: GeocodeResultDto | null }>(key);
    if (cached) return cached.v;
    const result = await this.geocoder.reverse(lat, lng, q.locale);
    await this.redis.setJson(key, { v: result }, CACHE_TTL);
    return result;
  }

  @Get('search')
  async search(
    @ZodQuery(searchSchema) q: z.output<typeof searchSchema>,
  ): Promise<GeocodeResultDto[]> {
    const key = `cache:geo:search:${q.locale}:${q.q.toLowerCase()}`;
    const cached = await this.redis.getJson<GeocodeResultDto[]>(key);
    if (cached) return cached;
    const result = await this.geocoder.search(q.q, q.locale);
    await this.redis.setJson(key, result, CACHE_TTL);
    return result;
  }
}
