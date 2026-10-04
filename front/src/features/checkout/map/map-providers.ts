/**
 * Map tile providers. The picker only depends on this config, so switching
 * provider (e.g. to a commercial tile service) is a configuration change.
 * Geocoding is done by the API (/geo/*), never directly from the browser.
 */
export interface TileProvider {
  url: string;
  attribution: string;
  maxZoom: number;
}

export const TILE_PROVIDERS: Record<string, TileProvider> = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

/** Yerevan city center */
export const DEFAULT_CENTER = { lat: 40.1792, lng: 44.4991 };
export const DEFAULT_ZOOM = 13;
