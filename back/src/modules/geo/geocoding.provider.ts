import { Logger } from '@nestjs/common';
import type { GeocodeResultDto, Locale } from '@market/shared';

/** Geocoding abstraction - the map UI and business logic never call a provider directly. */
export abstract class GeocodingProvider {
  abstract reverse(lat: number, lng: number, locale: Locale): Promise<GeocodeResultDto | null>;
  abstract search(query: string, locale: Locale): Promise<GeocodeResultDto[]>;
}

/** Fallback when geocoding is disabled: users simply type the address. */
export class NoopGeocodingProvider extends GeocodingProvider {
  reverse(): Promise<GeocodeResultDto | null> {
    return Promise.resolve(null);
  }

  search(): Promise<GeocodeResultDto[]> {
    return Promise.resolve([]);
  }
}

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
  };
}

/**
 * OpenStreetMap Nominatim (free, no key; good coverage of Armenia).
 * The public instance requires a descriptive User-Agent and ~1 req/s,
 * so results are cached by the service and the endpoint is rate limited.
 * Production can point NOMINATIM_URL to a self-hosted/commercial instance.
 */
export class NominatimGeocodingProvider extends GeocodingProvider {
  private readonly logger = new Logger(NominatimGeocodingProvider.name);

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
  ) {
    super();
  }

  async reverse(lat: number, lng: number, locale: Locale): Promise<GeocodeResultDto | null> {
    const url = new URL('/reverse', this.baseUrl);
    url.search = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      addressdetails: '1',
      zoom: '18',
    }).toString();
    const item = await this.request<NominatimItem>(url, locale);
    return item ? this.map(item) : null;
  }

  async search(query: string, locale: Locale): Promise<GeocodeResultDto[]> {
    const url = new URL('/search', this.baseUrl);
    url.search = new URLSearchParams({
      format: 'jsonv2',
      q: query,
      addressdetails: '1',
      limit: '5',
      countrycodes: 'am',
    }).toString();
    const items = await this.request<NominatimItem[]>(url, locale);
    return (items ?? []).map((i) => this.map(i));
  }

  private async request<T>(url: URL, locale: Locale): Promise<T | null> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': locale },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim responded ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`Nominatim request failed: ${(err as Error).message}`);
      return null;
    }
  }

  private map(item: NominatimItem): GeocodeResultDto {
    const a = item.address ?? {};
    const street = [a.road, a.house_number].filter(Boolean).join(' ') || null;
    return {
      displayName: item.display_name,
      country: a.country_code?.toUpperCase() ?? null,
      city: a.city ?? a.town ?? a.village ?? null,
      street,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    };
  }
}
