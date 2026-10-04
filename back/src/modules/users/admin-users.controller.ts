import { Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { adminUpdateUserSchema, adminUserListQuerySchema } from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { AdminOnly, Client, type ClientInfo, CurrentUser } from '../../common/auth/decorators';
import { UuidParam, ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin')
@AdminOnly()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@ZodQuery(adminUserListQuerySchema) query: z.output<typeof adminUserListQuerySchema>) {
    return this.users.list(query);
  }

  @Patch(':id')
  update(
    @UuidParam() id: string,
    @ZodBody(adminUpdateUserSchema) body: z.output<typeof adminUpdateUserSchema>,
    @CurrentUser() user: AuthUser,
    @Client() client: ClientInfo,
  ) {
    return this.users.update(id, body, user.id, client);
  }
}
