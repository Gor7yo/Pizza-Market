import { Injectable } from '@nestjs/common';
import type { changePasswordSchema, UserDto, updateProfileSchema } from '@market/shared';
import type { z } from 'zod';
import { AppException } from '../../common/errors/app.exception';
import { EmailService } from '../../infrastructure/email/email.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { ImageService } from '../../infrastructure/storage/image.service';
import { PasswordService } from '../auth/password.service';
import { SessionsService } from '../auth/sessions.service';
import { toUserDto, userWithAccountsInclude } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly images: ImageService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly email: EmailService,
  ) {}

  async updateProfile(
    userId: string,
    input: z.output<typeof updateProfileSchema>,
  ): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName === undefined ? undefined : input.lastName || null,
        phone: input.phone === undefined ? undefined : input.phone || null,
        locale: input.locale,
        preferredCurrency: input.preferredCurrency,
      },
      include: userWithAccountsInclude,
    });
    return toUserDto(user, this.storage);
  }

  /** Changing the password signs out every other device. */
  async changePassword(
    userId: string,
    sessionId: string,
    input: z.output<typeof changePasswordSchema>,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      const ok = await this.passwords.verify(user.passwordHash, input.currentPassword ?? '');
      if (!ok) throw AppException.badRequest('INVALID_CREDENTIALS', 'Current password is wrong');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.sessions.revokeAllForUser(userId, sessionId);
    await this.email.send({
      template: 'password-changed',
      to: user.email,
      locale: user.locale,
      data: { firstName: user.firstName },
    });
  }

  async setAvatar(userId: string, file: Buffer): Promise<UserDto> {
    const upload = await this.images.upload('avatar', file);
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: upload.key },
      include: userWithAccountsInclude,
    });
    await this.images.remove(previous.avatarKey);
    return toUserDto(user, this.storage);
  }

  async removeAvatar(userId: string): Promise<UserDto> {
    const previous = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarKey: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null },
      include: userWithAccountsInclude,
    });
    await this.images.remove(previous.avatarKey);
    return toUserDto(user, this.storage);
  }
}
