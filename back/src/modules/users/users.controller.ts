import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  type SessionDto,
  type UserDto,
  updateProfileSchema,
} from '@market/shared';
import type { z } from 'zod';
import type { AuthUser } from '../../common/auth/auth-user';
import { Authenticated, CurrentUser } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { UuidParam, ZodBody } from '../../common/validation/zod.decorators';
import { MAX_UPLOAD_BYTES } from '../../infrastructure/storage/image.service';
import { SessionsService } from '../auth/sessions.service';
import { UsersService } from './users.service';

@ApiTags('me')
@Authenticated()
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthUser,
    @ZodBody(updateProfileSchema) body: z.output<typeof updateProfileSchema>,
  ): Promise<UserDto> {
    return this.users.updateProfile(user.id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @ZodBody(changePasswordSchema) body: z.output<typeof changePasswordSchema>,
  ): Promise<void> {
    return this.users.changePassword(user.id, user.sessionId, body);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserDto> {
    if (!file) throw AppException.badRequest('INVALID_FILE', 'File is required');
    return this.users.setAvatar(user.id, file.buffer);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.removeAvatar(user.id);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.sessions.listActive(user.id, user.sessionId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @UuidParam() id: string): Promise<void> {
    return this.sessions.revokeOwned(user.id, id);
  }
}
