import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CategoryDto,
  type Paginated,
  type ProductCardDto,
  type ProductDetailDto,
  productListQuerySchema,
  slugSchema,
} from '@market/shared';
import type { z } from 'zod';
import { Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(): Promise<CategoryDto[]> {
    return this.catalog.categories();
  }

  @Get('products')
  products(
    @ZodQuery(productListQuerySchema) query: z.output<typeof productListQuerySchema>,
  ): Promise<Paginated<ProductCardDto>> {
    return this.catalog.products(query);
  }

  @Get('products/:slug')
  product(
    @Param('slug', new ZodValidationPipe(slugSchema)) slug: string,
  ): Promise<ProductDetailDto> {
    return this.catalog.productBySlug(slug);
  }

  @Get('sitemap-entries')
  sitemap() {
    return this.catalog.sitemapEntries();
  }
}
