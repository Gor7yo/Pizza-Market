import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [CatalogModule],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
