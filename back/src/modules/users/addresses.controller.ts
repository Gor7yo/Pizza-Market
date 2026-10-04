import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AddressData, type AddressDto, addressSchema } from '@market/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { Authenticated, CurrentUser } from '../../common/auth/decorators';
import { UuidParam, ZodBody } from '../../common/validation/zod.decorators';
import { AddressesService } from './addresses.service';

@ApiTags('me')
@Authenticated()
@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<AddressDto[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @ZodBody(addressSchema) body: AddressData,
  ): Promise<AddressDto> {
    return this.addresses.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @ZodBody(addressSchema) body: AddressData,
  ): Promise<AddressDto> {
    return this.addresses.update(user.id, id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
