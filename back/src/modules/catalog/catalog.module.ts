import { Module } from '@nestjs/common';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, AdminProductsController, AdminCatalogController],
  providers: [CatalogService, AdminProductsService, AdminCatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
