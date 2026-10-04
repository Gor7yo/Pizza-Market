import { Controller, Delete, Get, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ProductCardDto } from '@market/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { Authenticated, CurrentUser } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { UuidParam } from '../../common/validation/zod.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

@ApiTags('favorites')
@Authenticated()
@Controller('me/favorites')
export class FavoritesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ProductCardDto[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
    return this.catalog.productsByIds(rows.map((r) => r.productId));
  }

  @Get('ids')
  async ids(@CurrentUser() user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }

  /** Idempotent: adding twice is fine (composite primary key). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put(':id')
  async add(@CurrentUser() user: AuthUser, @UuidParam() productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isArchived: false },
    });
    if (!product) throw AppException.notFound('Product');
    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId },
      update: {},
    });
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @UuidParam() productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId: user.id, productId } });
  }
}
