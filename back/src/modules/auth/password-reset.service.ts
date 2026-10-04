import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { randomToken, sha256 } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config.service';
import { EmailService } from '../../infrastructure/email/email.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  PASSWORD_RESET_COOLDOWN_SECONDS,
  PASSWORD_RESET_TTL_MINUTES,
  redisKeys,
} from './auth.constants';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    private readonly email: EmailService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Always resolves the same way, whether or not the e-mail exists,
   * so the endpoint cannot be used to enumerate accounts.
   */
  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.isBlocked) return;

    const slot = await this.redis.client.set(
      redisKeys.resetCooldown(user.id),
      '1',
      'EX',
      PASSWORD_RESET_COOLDOWN_SECONDS,
      'NX',
    );
    if (slot !== 'OK') return;

    const token = randomToken(32);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
        },
      }),
    ]);

    // The token travels in the URL fragment: it is never sent to servers or logged in access logs.
    const url = `${this.config.get('PUBLIC_WEB_URL')}/reset-password#token=${encodeURIComponent(token)}`;
    await this.email.send({
      template: 'password-reset',
      to: user.email,
      locale: user.locale,
      data: { firstName: user.firstName, url, ttlMinutes: PASSWORD_RESET_TTL_MINUTES },
    });
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.isBlocked) {
      throw AppException.badRequest('INVALID_TOKEN', 'Reset link is invalid or expired');
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count !== 1)
        throw AppException.badRequest('INVALID_TOKEN', 'Reset link is invalid or expired');
      await tx.user.update({
        where: { id: record.userId },
        // the link proves control of the mailbox
        data: { passwordHash, emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      });
    });

    await this.sessions.revokeAllForUser(record.userId);
    await this.email.send({
      template: 'password-changed',
      to: record.user.email,
      locale: record.user.locale,
      data: { firstName: record.user.firstName },
    });
    this.logger.log(`Password reset completed for user ${record.userId}`);
  }
}
