import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { GeoController } from './geo.controller';
import {
  GeocodingProvider,
  NominatimGeocodingProvider,
  NoopGeocodingProvider,
} from './geocoding.provider';

@Module({
  controllers: [GeoController],
  providers: [
    {
      provide: GeocodingProvider,
      inject: [AppConfig],
      useFactory: (config: AppConfig): GeocodingProvider =>
        config.get('GEOCODER_PROVIDER') === 'nominatim'
          ? new NominatimGeocodingProvider(
              config.get('NOMINATIM_URL'),
              config.get('GEOCODER_USER_AGENT'),
            )
          : new NoopGeocodingProvider(),
    },
  ],
})
export class GeoModule {}
