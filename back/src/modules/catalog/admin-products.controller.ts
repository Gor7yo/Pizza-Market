import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { adminProductListQuerySchema, type ProductData, productInputSchema } from '@market/shared';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import {
  IMAGE_KINDS,
  type ImageKind,
  ImageService,
  MAX_UPLOAD_BYTES,
} from '../../infrastructure/storage/image.service';
import { AdminProductsService } from './admin-products.service';

const archiveSchema = z.strictObject({ isArchived: z.boolean() });
const availabilitySchema = z.strictObject({ isAvailable: z.boolean() });

@ApiTags('admin')
@AdminOnly()
@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly images: ImageService,
  ) {}

  @Get('products')
  list(@ZodQuery(adminProductListQuerySchema) query: z.output<typeof adminProductListQuerySchema>) {
    return this.products.list(query);
  }

  @Get('products/:id')
  get(@UuidParam() id: string) {
    return this.products.get(id);
  }

  @Post('products')
  create(
    @ZodBody(productInputSchema) body: ProductData,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.products.create(body, user.id, client);
  }

  @Put('products/:id')
  update(
    @UuidParam() id: string,
    @ZodBody(productInputSchema) body: ProductData,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.products.update(id, body, user.id, client);
  }

  @Patch('products/:id/archive')
  archive(
    @UuidParam() id: string,
    @ZodBody(archiveSchema) body: z.output<typeof archiveSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.products.setArchived(id, body.isArchived, user.id, client);
  }

  @Patch('products/:id/availability')
  availability(
    @UuidParam() id: string,
    @ZodBody(availabilitySchema) body: z.output<typeof availabilitySchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.products.setAvailability(id, body.isAvailable, user.id, client);
  }

  /** Uploads an image to object storage; the returned `key` is then saved on the entity. */
  @Post('uploads/:kind')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(
    @Param('kind', new ZodValidationPipe(z.enum(IMAGE_KINDS))) kind: ImageKind,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw AppException.badRequest('INVALID_FILE', 'File is required');
    return this.images.upload(kind, file.buffer);
  }
}
