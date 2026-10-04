import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USER_ROLES, type UserRole } from '@market/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { AppConfig } from '../../config/app-config.service';

interface AccessPayload {
  sub: string;
  role: UserRole;
  sid: string;
}

/** Short-lived stateless access tokens (JWT, HS256). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS');
  }

  signAccess(user: { id: string; role: UserRole }, sessionId: string): Promise<string> {
    const payload: AccessPayload = { sub: user.id, role: user.role, sid: sessionId };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtlSeconds,
      algorithm: 'HS256',
    });
  }

  async verifyAccess(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        !(USER_ROLES as readonly string[]).includes(payload.role)
      ) {
        return null;
      }
      return { id: payload.sub, role: payload.role, sessionId: payload.sid };
    } catch {
      return null;
    }
  }
}
