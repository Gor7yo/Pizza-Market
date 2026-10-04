import { Injectable, Logger } from '@nestjs/common';
import type { SessionDto, UserRole } from '@market/shared';
import type { ClientInfo } from '../../common/auth/decorators';
import { AppException } from '../../common/errors/app.exception';
import { randomToken, sha256 } from '../../common/utils/crypto';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { REFRESH_REUSE_GRACE_MS, redisKeys } from './auth.constants';

export interface RotationResult {
  userId: string;
  role: UserRole;
  sessionId: string;
  /** null when the request lost a concurrent-refresh race (cookies were already updated) */
  refreshToken: string | null;
}

/**
 * Server-side sessions with opaque refresh tokens.
 * - only SHA-256 hashes of refresh tokens are stored
 * - every refresh rotates the token
 * - presenting an already-rotated token (outside a short grace window) revokes the session
 * - revoked session ids are mirrored to Redis so access tokens die immediately
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
  ) {}

  private get ttlMs(): number {
    return this.config.get('REFRESH_TOKEN_TTL_DAYS') * 24 * 3600 * 1000;
  }

  async create(
    userId: string,
    client: ClientInfo,
  ): Promise<{ sessionId: string; refreshToken: string }> {
    const refreshToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        ip: client.ip,
        userAgent: client.userAgent,
        expiresAt: new Date(Date.now() + this.ttlMs),
      },
    });
    return { sessionId: session.id, refreshToken };
  }

  async rotate(refreshToken: string, client: ClientInfo): Promise<RotationResult> {
    const hash = sha256(refreshToken);
    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { select: { role: true, isBlocked: true } } },
    });

    if (!session) return this.handleUnknownToken(hash);

    if (session.revokedAt || session.expiresAt <= now) {
      throw AppException.unauthorized('SESSION_EXPIRED', 'Session expired');
    }
    if (session.user.isBlocked) {
      await this.revoke(session.id);
      throw AppException.forbidden('ACCOUNT_BLOCKED', 'Account is blocked');
    }

    const next = randomToken();
    // Optimistic concurrency: only one request can rotate a given token.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(next),
        previousTokenHash: hash,
        rotatedAt: now,
        lastUsedAt: now,
        ip: client.ip,
        userAgent: client.userAgent,
        // sliding expiration
        expiresAt: new Date(now.getTime() + this.ttlMs),
      },
    });

    return {
      userId: session.userId,
      role: session.user.role,
      sessionId: session.id,
      refreshToken: count === 1 ? next : null,
    };
  }

  private async handleUnknownToken(hash: string): Promise<RotationResult> {
    const rotated = await this.prisma.session.findUnique({
      where: { previousTokenHash: hash },
      include: { user: { select: { role: true, isBlocked: true } } },
    });
    if (rotated && !rotated.revokedAt && !rotated.user.isBlocked) {
      const withinGrace =
        rotated.rotatedAt && Date.now() - rotated.rotatedAt.getTime() < REFRESH_REUSE_GRACE_MS;
      if (withinGrace) {
        return {
          userId: rotated.userId,
          role: rotated.user.role,
          sessionId: rotated.id,
          refreshToken: null,
        };
      }
      this.logger.warn(`Refresh token reuse detected, revoking session ${rotated.id}`);
      await this.revoke(rotated.id);
    }
    throw AppException.unauthorized('SESSION_EXPIRED', 'Session expired');
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.markRevoked([sessionId]);
  }

  async revokeByRefreshToken(refreshToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      select: { id: true },
    });
    if (session) await this.revoke(session.id);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const active = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        id: exceptSessionId ? { not: exceptSessionId } : undefined,
      },
      select: { id: true },
    });
    if (active.length === 0) return;
    const ids = active.map((s) => s.id);
    await this.prisma.session.updateMany({
      where: { id: { in: ids } },
      data: { revokedAt: new Date() },
    });
    await this.markRevoked(ids);
  }

  async revokeOwned(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw AppException.notFound('Session');
    await this.revoke(session.id);
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    return (await this.redis.client.exists(redisKeys.revokedSession(sessionId))) === 1;
  }

  async listActive(userId: string, currentSessionId: string): Promise<SessionDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** Access tokens live at most JWT_ACCESS_TTL_SECONDS, so the flag can expire after that. */
  private async markRevoked(ids: string[]): Promise<void> {
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS') + 60;
    const pipeline = this.redis.client.pipeline();
    for (const id of ids) pipeline.set(redisKeys.revokedSession(id), '1', 'EX', ttl);
    await pipeline.exec();
  }
}
