import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { hmacSha256, randomNumericCode, safeEqual } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import {
  redisKeys,
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from './auth.constants';

/**
 * 6-digit e-mail verification codes.
 * Stored as HMAC (keyed with a server secret, so a DB leak does not allow
 * brute-forcing 10^6 codes offline), single-use, expiring, attempt-limited.
 */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  private hash(userId: string, code: string): string {
    return hmacSha256(this.config.get('CODE_HMAC_SECRET'), `${userId}:${code}`);
  }

  /** Returns false when a code was sent too recently. */
  async tryAcquireResendSlot(userId: string): Promise<boolean> {
    const ok = await this.redis.client.set(
      redisKeys.verifyCooldown(userId),
      '1',
      'EX',
      VERIFICATION_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    return ok === 'OK';
  }

  async issue(userId: string): Promise<{ code: string; ttlMinutes: number }> {
    const code = randomNumericCode(6);
    const now = new Date();
    await this.prisma.$transaction([
      // only the newest code is valid
      this.prisma.verificationCode.updateMany({
        where: { userId, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.verificationCode.create({
        data: {
          userId,
          purpose: 'EMAIL_VERIFICATION',
          codeHash: this.hash(userId, code),
          expiresAt: new Date(now.getTime() + VERIFICATION_CODE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    return { code, ttlMinutes: VERIFICATION_CODE_TTL_MINUTES };
  }

  async consume(userId: string, code: string): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw AppException.badRequest('INVALID_CODE', 'Invalid code');
    if (record.expiresAt <= new Date())
      throw AppException.badRequest('CODE_EXPIRED', 'Code expired');
    if (record.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      throw AppException.tooMany('TOO_MANY_ATTEMPTS', 'Too many attempts, request a new code');
    }

    if (!safeEqual(record.codeHash, this.hash(userId, code))) {
      await this.prisma.verificationCode.updateMany({
        where: { id: record.id, attempts: { lt: VERIFICATION_MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      throw AppException.badRequest('INVALID_CODE', 'Invalid code');
    }

    // single use: the conditional update fails if a parallel request consumed it first
    const { count } = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count !== 1) throw AppException.badRequest('INVALID_CODE', 'Invalid code');
  }
}
