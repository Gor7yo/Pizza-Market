import { Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { categoryInputSchema, crustInputSchema, ingredientInputSchema } from '@market/shared';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { UuidParam, ZodBody } from '../../common/validation/zod.decorators';
import { AdminCatalogService } from './admin-catalog.service';

const archiveSchema = z.strictObject({ isArchived: z.boolean() });
type Archive = z.output<typeof archiveSchema>;

@ApiTags('admin')
@AdminOnly()
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Post('categories')
  createCategory(
    @ZodBody(categoryInputSchema) body: z.output<typeof categoryInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveCategory(null, body, user.id, client);
  }

  @Put('categories/:id')
  updateCategory(
    @UuidParam() id: string,
    @ZodBody(categoryInputSchema) body: z.output<typeof categoryInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveCategory(id, body, user.id, client);
  }

  @Patch('categories/:id/archive')
  archiveCategory(
    @UuidParam() id: string,
    @ZodBody(archiveSchema) body: Archive,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.archiveCategory(id, body.isArchived, user.id, client);
  }

  @Get('ingredients')
  ingredients() {
    return this.catalog.listIngredients();
  }

  @Post('ingredients')
  createIngredient(
    @ZodBody(ingredientInputSchema) body: z.output<typeof ingredientInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveIngredient(null, body, user.id, client);
  }

  @Put('ingredients/:id')
  updateIngredient(
    @UuidParam() id: string,
    @ZodBody(ingredientInputSchema) body: z.output<typeof ingredientInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveIngredient(id, body, user.id, client);
  }

  @Patch('ingredients/:id/archive')
  archiveIngredient(
    @UuidParam() id: string,
    @ZodBody(archiveSchema) body: Archive,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.archiveIngredient(id, body.isArchived, user.id, client);
  }

  @Get('crusts')
  crusts() {
    return this.catalog.listCrusts();
  }

  @Post('crusts')
  createCrust(
    @ZodBody(crustInputSchema) body: z.output<typeof crustInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveCrust(null, body, user.id, client);
  }

  @Put('crusts/:id')
  updateCrust(
    @UuidParam() id: string,
    @ZodBody(crustInputSchema) body: z.output<typeof crustInputSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.saveCrust(id, body, user.id, client);
  }

  @Patch('crusts/:id/archive')
  archiveCrust(
    @UuidParam() id: string,
    @ZodBody(archiveSchema) body: Archive,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.catalog.archiveCrust(id, body.isArchived, user.id, client);
  }
}
