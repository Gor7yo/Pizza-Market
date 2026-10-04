import { Injectable } from '@nestjs/common';
import type {
  LoginInput,
  RegisterResultDto,
  UserDto,
  registerSchema,
  verifyEmailSchema,
} from '@market/shared';
import type { z } from 'zod';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { EmailService } from '../../infrastructure/email/email.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { toUserDto, userWithAccountsInclude } from '../users/user.mapper';
import { LOGIN_LOCKOUT_SECONDS, LOGIN_MAX_FAILURES, redisKeys } from './auth.constants';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

export interface IssuedSession {
  user: UserDto;
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly verification: VerificationService,
    private readonly email: EmailService,
    private readonly storage: FileStorage,
  ) {}

  /**
   * Creates an unverified account and e-mails a code. The account becomes usable
   * only after verifyEmail(). Re-registering an unverified e-mail refreshes it.
   */
  async register(input: z.output<typeof registerSchema>): Promise<RegisterResultDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing?.emailVerifiedAt)
      throw AppException.conflict('EMAIL_TAKEN', 'E-mail is already registered');

    const passwordHash = await this.passwords.hash(input.password);
    const data = {
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName || null,
      locale: input.locale ?? 'ru',
    };
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data })
      : await this.prisma.user.create({ data: { ...data, email: input.email } });

    await this.verification.tryAcquireResendSlot(user.id);
    const { code, ttlMinutes } = await this.verification.issue(user.id);
    await this.email.send({
      template: 'verify-email',
      to: user.email,
      locale: user.locale,
      data: { firstName: user.firstName, code, ttlMinutes },
    });
    return { email: user.email, codeTtlSeconds: ttlMinutes * 60 };
  }

  async verifyEmail(
    input: z.output<typeof verifyEmailSchema>,
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.emailVerifiedAt) {
      // indistinguishable from a wrong code
      throw AppException.badRequest('INVALID_CODE', 'Invalid code');
    }
    await this.verification.consume(user.id, input.code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return this.startSession(user.id, client);
  }

  /** Silent no-op for unknown/verified e-mails and during the cooldown (no enumeration). */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.isBlocked) return;
    if (!(await this.verification.tryAcquireResendSlot(user.id))) return;
    const { code, ttlMinutes } = await this.verification.issue(user.id);
    await this.email.send({
      template: 'verify-email',
      to: user.email,
      locale: user.locale,
      data: { firstName: user.firstName, code, ttlMinutes },
    });
  }

  async login(input: LoginInput, client: ClientInfo): Promise<IssuedSession> {
    const email = input.email.toLowerCase();
    const failKey = redisKeys.loginFailures(email);
    const failures = Number((await this.redis.client.get(failKey)) ?? 0);
    if (failures >= LOGIN_MAX_FAILURES) {
      throw AppException.tooMany('TOO_MANY_ATTEMPTS', 'Too many failed attempts, try again later');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await this.passwords.verify(user?.passwordHash, input.password);
    if (!user || !valid) {
      await this.redis.client.multi().incr(failKey).expire(failKey, LOGIN_LOCKOUT_SECONDS).exec();
      throw AppException.unauthorized('INVALID_CREDENTIALS', 'Invalid e-mail or password');
    }

    await this.redis.client.del(failKey);
    if (user.isBlocked) throw AppException.forbidden('ACCOUNT_BLOCKED', 'Account is blocked');
    if (!user.emailVerifiedAt) {
      // the password was correct, so revealing the state to the owner is safe
      throw AppException.forbidden('EMAIL_NOT_VERIFIED', 'E-mail is not verified');
    }
    return this.startSession(user.id, client);
  }

  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<IssuedSession> {
    if (!refreshToken) throw AppException.unauthorized('SESSION_EXPIRED', 'Session expired');
    const rotation = await this.sessions.rotate(refreshToken, client);
    const accessToken = await this.tokens.signAccess(
      { id: rotation.userId, role: rotation.role },
      rotation.sessionId,
    );
    return {
      user: await this.me(rotation.userId),
      accessToken,
      refreshToken: rotation.refreshToken,
    };
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId);
    else if (refreshToken) await this.sessions.revokeByRefreshToken(refreshToken);
  }

  async startSession(userId: string, client: ClientInfo): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithAccountsInclude,
    });
    const { sessionId, refreshToken } = await this.sessions.create(user.id, client);
    const accessToken = await this.tokens.signAccess(user, sessionId);
    return { user: toUserDto(user, this.storage), accessToken, refreshToken };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithAccountsInclude,
    });
    if (!user) throw AppException.unauthorized();
    return toUserDto(user, this.storage);
  }
}
