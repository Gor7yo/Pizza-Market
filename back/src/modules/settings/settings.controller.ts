import { Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type StoreSettingsData, storeSettingsSchema } from '@market/shared';
import {
  AdminOnly,
  Client,
  type ClientInfo,
  CurrentUser,
  Public,
} from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth-user';
import { ZodBody } from '../../common/validation/zod.decorators';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public store info: currency, delivery pricing, display exchange rates. */
  @Public()
  @Get('settings')
  getPublic() {
    return this.settings.get();
  }

  @AdminOnly()
  @Get('admin/settings')
  getAdmin() {
    return this.settings.get();
  }

  @AdminOnly()
  @Put('admin/settings')
  update(
    @ZodBody(storeSettingsSchema) body: StoreSettingsData,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.settings.update(body, user.id, client);
  }
}
